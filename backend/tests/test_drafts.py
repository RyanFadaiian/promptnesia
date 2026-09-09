import unittest
from unittest.mock import patch

from app import main as game


class DraftTests(unittest.TestCase):
    def setUp(self):
        game.lobbies.clear()
        self.lobby = game.create_lobby(game.CreateLobbyRequest(username="Host"))
        self.code = self.lobby["id"]
        game.join_lobby(self.code, game.AddPlayerRequest(username="Guest"))
        game.start_game(self.code)
        self.queue = patch.object(game.images.image_queue, "submit").start()
        self.addCleanup(patch.stopall)

    def save(self, prompt, revision=1, current_round=1):
        return game.save_prompt_draft(self.code, game.SavePromptDraftRequest(
            username="Host", prompt=prompt, revision=revision, current_round=current_round,
        ))

    def test_timeout_uses_latest_draft_once_without_early_submission(self):
        self.save("A dancing cat", 2)
        self.save("A dancing", 1)
        self.assertEqual(game.submitted_players(self.lobby), [])
        self.queue.assert_not_called()
        self.lobby["prompt_deadline"] = 0
        game.send_state(self.code)
        game.send_state(self.code)
        self.assertEqual(self.lobby["players"]["Host"]["prompt"], "A dancing cat")
        self.assertIn(self.lobby["players"]["Guest"]["prompt"], game.DEFAULT_PROMPTS)
        self.assertEqual(self.queue.call_count, 2)

    def test_cleared_draft_uses_random_prompt(self):
        self.save("A cat")
        self.save("   ", 2)
        self.lobby["prompt_deadline"] = 0
        game.send_state(self.code)
        self.assertIn(self.lobby["players"]["Host"]["prompt"], game.DEFAULT_PROMPTS)

    def test_manual_submission_cannot_be_overwritten(self):
        self.save("Draft")
        game.store_prompt(self.code, game.AddPromptRequest(username="Host", prompt="Final"))
        self.save("Late draft", 2)
        self.lobby["prompt_deadline"] = 0
        game.send_state(self.code)
        self.assertEqual(self.lobby["players"]["Host"]["prompt"], "Final")
        self.assertEqual(self.queue.call_count, 2)

    def test_late_and_previous_round_drafts_are_ignored(self):
        self.lobby["prompt_deadline"] = 0
        self.assertEqual(self.save("Late")["status"], "ignored")
        game.start_round(self.lobby)
        self.assertEqual(self.save("Old round")["status"], "ignored")
        self.assertEqual(self.lobby["players"]["Host"]["draft"], "")
