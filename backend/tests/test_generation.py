import asyncio
import base64
import httpx2
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from app import main as game
from app import images


class GenerationTests(unittest.TestCase):
    def setUp(self):
        game.lobbies.clear()
        folder = TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.directory = Path(folder.name)
        self.image = b"test image bytes"
        response = SimpleNamespace(data=[SimpleNamespace(
            b64_json=base64.b64encode(self.image).decode(),
        )])
        for name, replacement in [("generated_dir", self.directory), ("image_queue", None)]:
            mock = patch.object(images, name, replacement) if replacement is not None else patch.object(images, name)
            value = mock.start()
            self.addCleanup(mock.stop)
            if name == "image_queue":
                self.worker = value
        api = patch.object(images.client.images, "generate", return_value=response)
        self.generate = api.start()
        self.addCleanup(api.stop)
        rewrite = patch.object(images.client.responses, "create", return_value=SimpleNamespace(output_text="A playful cartoon cat"))
        self.rewrite = rewrite.start()
        self.addCleanup(rewrite.stop)
        self.lobby = game.create_lobby(game.CreateLobbyRequest(username="Host"))
        self.code = self.lobby["id"]
        game.join_lobby(self.code, game.AddPlayerRequest(username="Guest"))
        game.start_game(self.code)

    def test_generates_once_saves_and_serves_images(self):
        for name in self.lobby["players"]:
            game.store_prompt(self.code, game.AddPromptRequest(username=name, prompt=f"A cat for {name}"))
        with ThreadPoolExecutor(max_workers=4) as pool:
            states = list(pool.map(lambda _: game.send_state(self.code), range(8)))
        self.assertTrue(all(state["phase"] == "GENERATING" for state in states))
        self.assertEqual(self.worker.submit.call_count, 2)
        self.generate.assert_not_called()

        for player in self.lobby["players"].values():
            images.generate_image(player)
        state = game.send_state(self.code)
        self.assertEqual(state["phase"], "GUESSING")
        self.assertEqual(self.generate.call_count, 2)
        self.generate.assert_any_call(model="gpt-image-2", prompt="A cat for Host")
        urls = [player["image_url"] for player in self.lobby["players"].values()]
        self.assertEqual(len(set(urls)), 2)
        static = next(route.app for route in game.app.routes if route.path == "/generated")
        with patch.object(static, "all_directories", [str(self.directory)]):
            for url in urls:
                self.assertTrue(url.startswith("http://127.0.0.1:8000/generated/"))
                filename = url.rsplit("/", 1)[1]
                response = asyncio.run(static.get_response(filename, {"method": "GET", "headers": []}))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(Path(response.path).read_bytes(), self.image)
        self.assertNotIn("prompt", state["current_image"])

    def test_api_failure_keeps_placeholder_and_continues(self):
        for name in self.lobby["players"]:
            game.store_prompt(self.code, game.AddPromptRequest(username=name, prompt="A cat"))
        success = self.generate.return_value
        self.generate.side_effect = [RuntimeError("Test failure"), success]
        with self.assertLogs(level="WARNING"):
            for player in self.lobby["players"].values():
                images.generate_image(player)
        self.assertEqual(self.lobby["players"]["Host"]["image_url"], "/1.png")
        self.assertIn("/generated/", self.lobby["players"]["Guest"]["image_url"])
        self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")

    def rejection(self, code="moderation_blocked"):
        response = httpx2.Response(400, request=httpx2.Request("POST", "https://api.openai.com/v1/images/generations"))
        return images.BadRequestError("Rejected", response=response, body={"code": code})

    def test_rejected_prompt_is_rewritten_once(self):
        player = self.lobby["players"]["Host"]
        player["prompt"] = "Original joke"
        self.generate.side_effect = [self.rejection(), self.generate.return_value]
        images.generate_image(player)
        self.rewrite.assert_called_once()
        self.assertEqual(self.rewrite.call_args.kwargs["input"], "Original joke")
        self.generate.assert_called_with(model="gpt-image-2", prompt="A playful cartoon cat")
        self.assertEqual(player["prompt"], "Original joke")
        self.assertIn("/generated/", player["image_url"])
        self.assertTrue(player["image_ready"])

    def test_second_rejection_uses_not_allowed(self):
        player = self.lobby["players"]["Host"]
        player["prompt"] = "Original joke"
        self.generate.side_effect = [self.rejection(), self.rejection()]
        with self.assertLogs(level="WARNING"):
            images.generate_image(player)
        self.assertEqual(self.generate.call_count, 2)
        self.rewrite.assert_called_once()
        self.assertEqual(player["image_url"], "/not_allowed.png")
        self.assertTrue(player["image_ready"])
        self.assertTrue((Path(__file__).resolve().parents[2] / "frontend/public/not_allowed.png").is_file())

    def test_unrelated_error_does_not_rewrite(self):
        player = self.lobby["players"]["Host"]
        self.generate.side_effect = self.rejection("invalid_value")
        with self.assertLogs(level="WARNING"):
            images.generate_image(player)
        self.rewrite.assert_not_called()
        self.generate.assert_called_once()
        self.assertEqual(player["image_url"], "/1.png")

    def test_empty_or_failed_rewrite_finishes_with_fallback(self):
        for fails in [False, True]:
            with self.subTest(fails=fails):
                player = game.new_player()
                player["prompt"] = "Original joke"
                self.generate.reset_mock()
                self.generate.side_effect = self.rejection()
                self.rewrite.return_value = SimpleNamespace(output_text=" ")
                self.rewrite.side_effect = RuntimeError("Test failure") if fails else None
                with patch.object(images.logging, "warning"):
                    images.generate_image(player)
                self.generate.assert_called_once()
                self.assertTrue(player["image_ready"])
                self.assertEqual(player["image_url"], "/not_allowed.png")

    def test_timeout_generates_missing_prompt_once(self):
        game.store_prompt(self.code, game.AddPromptRequest(username="Host", prompt="A cat"))
        with patch.object(game.time, "monotonic", return_value=self.lobby["prompt_deadline"]):
            self.assertEqual(game.send_state(self.code)["phase"], "GENERATING")
            game.send_state(self.code)
        guest = self.lobby["players"]["Guest"]
        self.assertIn(guest["prompt"], game.DEFAULT_PROMPTS)
        self.assertFalse(guest["image_ready"])
        self.assertEqual(self.worker.submit.call_count, 2)
        self.worker.submit.assert_called_with(images.generate_image, guest)
        self.assertEqual(self.lobby["players"]["Host"]["prompt"], "A cat")
        images.generate_image(guest)
        self.generate.assert_called_once_with(model="gpt-image-2", prompt=guest["prompt"])
        self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")

    def test_blank_submission_generates_fallback_once(self):
        for prompt in ["", "   "]:
            with self.subTest(prompt=prompt):
                self.lobby["players"]["Host"] = game.new_player()
                self.worker.reset_mock()
                request = game.AddPromptRequest(username="Host", prompt=prompt)
                game.store_prompt(self.code, request)
                player = self.lobby["players"]["Host"]
                self.assertIn(player["prompt"], game.DEFAULT_PROMPTS)
                chosen_prompt = player["prompt"]
                game.store_prompt(self.code, request)
                self.assertEqual(player["prompt"], chosen_prompt)
                self.worker.submit.assert_called_once_with(images.generate_image, player)

    def test_submission_queues_once_before_prompting_ends(self):
        request = game.AddPromptRequest(username="Host", prompt="A cat")
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda _: game.store_prompt(self.code, request), range(8)))
        player = self.lobby["players"]["Host"]
        self.worker.submit.assert_called_once_with(images.generate_image, player)
        self.assertEqual(game.send_state(self.code)["phase"], "PROMPTING")
        images.generate_image(player)
        url = player["image_url"]
        self.assertTrue(player["image_ready"])
        self.assertEqual(game.send_state(self.code)["phase"], "PROMPTING")
        game.store_prompt(self.code, game.AddPromptRequest(username="Guest", prompt="A dog"))
        self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")
        self.assertEqual(player["image_url"], url)
        images.generate_image(self.lobby["players"]["Guest"])
        self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")

    def test_ready_images_skip_wait_at_deadline(self):
        game.store_prompt(self.code, game.AddPromptRequest(username="Host", prompt="A cat"))
        images.generate_image(self.lobby["players"]["Host"])
        with patch.object(game.time, "monotonic", return_value=self.lobby["prompt_deadline"]):
            self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")
        self.assertFalse(self.lobby["players"]["Guest"]["image_ready"])
        self.assertEqual(self.worker.submit.call_count, 2)


if __name__ == "__main__":
    unittest.main()
