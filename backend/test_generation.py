import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from app import main as game


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
            mock = patch.object(game, name, replacement) if replacement is not None else patch.object(game, name)
            value = mock.start()
            self.addCleanup(mock.stop)
            if name == "image_queue":
                self.worker = value
        api = patch.object(game.client.images, "generate", return_value=response)
        self.generate = api.start()
        self.addCleanup(api.stop)
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
            game.generate_image(player)
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
                game.generate_image(player)
        self.assertEqual(self.lobby["players"]["Host"]["image_url"], "/1.png")
        self.assertIn("/generated/", self.lobby["players"]["Guest"]["image_url"])
        self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")

    def test_timeout_skips_missing_prompt(self):
        game.store_prompt(self.code, game.AddPromptRequest(username="Host", prompt="A cat"))
        with patch.object(game.time, "monotonic", return_value=self.lobby["prompt_deadline"]):
            self.assertEqual(game.send_state(self.code)["phase"], "GENERATING")
        game.generate_image(self.lobby["players"]["Host"])
        self.generate.assert_called_once_with(model="gpt-image-2", prompt="A cat")
        self.assertEqual(self.lobby["players"]["Guest"]["image_url"], "/2.png")
        self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")

    def test_submission_queues_once_before_prompting_ends(self):
        request = game.AddPromptRequest(username="Host", prompt="A cat")
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda _: game.store_prompt(self.code, request), range(8)))
        player = self.lobby["players"]["Host"]
        self.worker.submit.assert_called_once_with(game.generate_image, player)
        self.assertEqual(game.send_state(self.code)["phase"], "PROMPTING")
        game.generate_image(player)
        url = player["image_url"]
        self.assertTrue(player["image_ready"])
        self.assertEqual(game.send_state(self.code)["phase"], "PROMPTING")
        game.store_prompt(self.code, game.AddPromptRequest(username="Guest", prompt="A dog"))
        self.assertEqual(game.send_state(self.code)["phase"], "GENERATING")
        self.assertEqual(player["image_url"], url)
        game.generate_image(self.lobby["players"]["Guest"])
        self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")

    def test_ready_images_skip_wait_at_deadline(self):
        game.store_prompt(self.code, game.AddPromptRequest(username="Host", prompt="A cat"))
        game.generate_image(self.lobby["players"]["Host"])
        with patch.object(game.time, "monotonic", return_value=self.lobby["prompt_deadline"]):
            self.assertEqual(game.send_state(self.code)["phase"], "GUESSING")
        self.assertTrue(self.lobby["players"]["Guest"]["image_ready"])
        self.assertEqual(self.worker.submit.call_count, 1)


if __name__ == "__main__":
    unittest.main()
