import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from app import main as game


class GuessingTests(unittest.TestCase):
    def setUp(self):
        game.lobbies.clear()
        self.clock = patch.object(game.time, "monotonic", return_value=100)
        self.now = self.clock.start()
        self.addCleanup(self.clock.stop)
        worker = patch.object(game.images, "image_queue")
        worker.start()
        self.addCleanup(worker.stop)
        self.lobby = game.create_lobby(game.CreateLobbyRequest(username="Host"))
        self.code = self.lobby["id"]

    def start(self, guests=("Alice", "Bob")):
        for name in guests:
            game.join_lobby(self.code, game.AddPlayerRequest(username=name))
        game.start_game(self.code)
        for name in self.lobby["players"]:
            game.store_prompt(self.code, game.AddPromptRequest(username=name, prompt="Secret prompt"))
        # These tests cover gameplay after the image worker finishes.
        for player in self.lobby["players"].values():
            player["image_ready"] = True
        game.update_prompting(self.lobby)

    def guess(self, username, guess="A cat", index=0):
        return game.store_guess(self.code, game.AddGuessRequest(
            username=username, guess=guess, current_image_index=index,
        ))

    def pick(self, username="Host", winner="Alice", index=0):
        return game.pick_winner(self.code, game.PickWinnerRequest(
            username=username, winner=winner, current_image_index=index,
        ))

    def test_reveal_waits_for_every_eligible_player(self):
        self.start()
        self.guess("Alice", "  A cat  ")
        self.guess("Alice", "Duplicate")
        state = game.send_state(self.code)
        self.assertEqual(state["phase"], "GUESSING")
        self.assertEqual(state["guessed_players"], ["Alice"])
        self.assertEqual(state["eligible_guessers"], 2)
        self.assertEqual(state["guesses"], {})
        self.assertNotIn("prompt", state["current_image"])
        self.assertEqual(self.lobby["guesses"][0], {"Alice": "A cat"})
        self.guess("Bob", "A dog")
        state = game.send_state(self.code)
        self.assertEqual(state["phase"], "REVEAL")
        self.assertEqual(state["current_image"]["prompt"], "Secret prompt")
        self.assertEqual(state["guesses"], {"Alice": "A cat", "Bob": "A dog"})
        self.assertEqual(state, game.send_state(self.code))
        with self.assertRaises(HTTPException):
            self.guess("Bob", "Changed")

    def test_invalid_guesses_and_late_joins(self):
        self.start()
        for username, guess, index, status in [
            ("Host", "A cat", 0, 403), ("Unknown", "A cat", 0, 403),
            ("Alice", "  ", 0, 400), ("Alice", "A cat", 1, 409),
        ]:
            with self.subTest(username=username, guess=guess, index=index):
                with self.assertRaises(HTTPException) as error:
                    self.guess(username, guess, index)
                self.assertEqual(error.exception.status_code, status)
        self.assertEqual(self.lobby["guesses"], {})
        with self.assertRaises(HTTPException):
            game.join_lobby(self.code, game.AddPlayerRequest(username="Late"))

    def test_guesses_are_separate_for_each_image(self):
        self.start()
        self.guess("Alice")
        self.lobby["current_image_index"] = 1
        self.guess("Host", "A tree", index=1)
        self.assertEqual(self.lobby["guesses"][0], {"Alice": "A cat"})
        self.assertEqual(self.lobby["guesses"][1], {"Host": "A tree"})
        self.assertEqual(game.send_state(self.code)["guessed_players"], ["Host"])

    def test_start_requires_at_least_two_players(self):
        with self.assertRaises(HTTPException) as error:
            game.start_game(self.code)
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "You need at least 2 players to start the game!")
        self.assertEqual(self.lobby["phase"], "LOBBY")
        self.assertNotIn("prompt_deadline", self.lobby)
        game.join_lobby(self.code, game.AddPlayerRequest(username="Guest"))
        self.assertEqual(game.start_game(self.code), "PROMPTING")

    def test_round_settings_require_host_and_lobby_and_valid_range(self):
        for rounds in [0, 4, 1.5]:
            with self.assertRaises(ValidationError):
                game.SetRoundsRequest(username="Host", rounds=rounds)
        with self.assertRaises(HTTPException) as error:
            game.set_rounds(self.code, game.SetRoundsRequest(username="Guest", rounds=2))
        self.assertEqual(error.exception.status_code, 403)
        game.set_rounds(self.code, game.SetRoundsRequest(username="Host", rounds=3))
        self.assertEqual(game.send_state(self.code)["rounds"], 3)
        self.start()
        with self.assertRaises(HTTPException) as error:
            game.set_rounds(self.code, game.SetRoundsRequest(username="Host", rounds=1))
        self.assertEqual(error.exception.status_code, 409)

    def test_three_rounds_keep_scores_and_reset_prompts(self):
        game.set_rounds(self.code, game.SetRoundsRequest(username="Host", rounds=3))
        self.start(guests=("Alice",))
        for round_number in range(1, 4):
            self.assertEqual(self.lobby["current_round"], round_number)
            if round_number > 1:
                self.assertEqual(self.lobby["phase"], "PROMPTING")
                self.assertEqual(self.lobby["guesses"], {})
                self.assertEqual(self.lobby["shown_images"], [])
                for name, player in self.lobby["players"].items():
                    self.assertIsNone(player["prompt"])
                    self.assertFalse(player["image_ready"])
                    game.store_prompt(self.code, game.AddPromptRequest(username=name, prompt="New prompt"))
                    player["image_ready"] = True
                game.update_prompting(self.lobby)
            for index, (author, guesser) in enumerate([("Host", "Alice"), ("Alice", "Host")]):
                self.guess(guesser, index=index)
                self.pick(author, guesser, index)
                self.now.return_value += 5
                game.send_state(self.code)
            self.assertEqual(self.lobby["players"]["Host"]["score"], round_number)
            self.assertEqual(self.lobby["players"]["Alice"]["score"], round_number)
        self.assertEqual(self.lobby["phase"], "GAME_OVER")
        game.return_to_lobby(self.code, game.ReturnToLobbyRequest(username="Host"))
        self.assertEqual(self.lobby["current_round"], 0)
        self.assertEqual(self.lobby["rounds"], 3)
        self.assertEqual(self.lobby["players"]["Host"]["score"], 0)

    def test_only_author_can_pick_a_submitted_guess_once(self):
        self.start()
        with self.assertRaises(HTTPException):
            self.pick()
        self.guess("Alice")
        self.guess("Bob")
        for author, winner, index in [("Alice", "Bob", 0), ("Host", "Host", 0), ("Host", "Alice", 1)]:
            with self.assertRaises(HTTPException):
                self.pick(author, winner, index)
        self.assertTrue(all(player["score"] == 0 for player in self.lobby["players"].values()))
        self.pick()
        for winner in ["Alice", "Bob"]:
            with self.assertRaises(HTTPException):
                self.pick(winner=winner)
        state = game.send_state(self.code)
        self.assertEqual(state["winner"], "Alice")
        self.assertEqual(state["scores"], {"Host": 0, "Alice": 1, "Bob": 0})

    def test_return_to_lobby_requires_host_and_game_over(self):
        self.start()
        request = game.ReturnToLobbyRequest(username="Host")
        with self.assertRaises(HTTPException) as error:
            game.return_to_lobby(self.code, request)
        self.assertEqual(error.exception.status_code, 409)
        self.lobby["phase"] = "GAME_OVER"
        with self.assertRaises(HTTPException) as error:
            game.return_to_lobby(self.code, game.ReturnToLobbyRequest(username="Alice"))
        self.assertEqual(error.exception.status_code, 403)
        self.assertEqual(self.lobby["phase"], "GAME_OVER")

    def test_return_clears_game_and_allows_replay(self):
        self.start()
        self.guess("Alice")
        self.guess("Bob")
        self.pick()
        self.lobby["phase"] = "GAME_OVER"
        self.lobby["current_image_index"] = 2
        game.return_to_lobby(self.code, game.ReturnToLobbyRequest(username="Host"))
        self.assertEqual(game.retrieve_lobby(self.code), {
            "players": ["Host", "Alice", "Bob"], "host": "Host",
        })
        self.assertEqual(self.lobby["id"], self.code)
        self.assertEqual(game.send_state(self.code)["phase"], "LOBBY")
        self.assertTrue(all(player == game.new_player() for player in self.lobby["players"].values()))
        self.assertEqual(self.lobby["guesses"], {})
        self.assertEqual(self.lobby["current_image_index"], 0)
        self.assertEqual(self.lobby["shown_images"], [])
        self.assertIsNone(self.lobby["winner"])
        self.assertIsNone(self.lobby["next_image_at"])
        self.assertNotIn("prompt_deadline", self.lobby)
        self.now.return_value = 200
        game.start_game(self.code)
        state = game.send_state(self.code)
        self.assertEqual(state["phase"], "PROMPTING")
        self.assertEqual(state["seconds_left"], 40)
        game.store_prompt(self.code, game.AddPromptRequest(username="Host", prompt="New prompt"))
        self.assertEqual(self.lobby["players"]["Host"]["prompt"], "New prompt")

    def test_ready_images_play_out_of_order_and_wait_on_reveal(self):
        self.start()
        self.lobby["phase"] = "GENERATING"
        self.lobby["shown_images"] = []
        for player in self.lobby["players"].values():
            player["image_ready"] = False
        self.assertEqual(game.send_state(self.code)["phase"], "GENERATING")
        self.lobby["players"]["Bob"]["image_ready"] = True
        state = game.send_state(self.code)
        self.assertEqual(state["current_image_index"], 2)
        self.assertEqual(state["current_image"]["number"], 1)
        self.guess("Host", index=2)
        self.guess("Alice", index=2)
        self.pick("Bob", "Alice", index=2)
        self.now.return_value = 105
        state = game.send_state(self.code)
        self.assertEqual(state["phase"], "REVEAL")
        self.assertEqual(state["winner"], "Alice")
        self.assertEqual(state["current_image_index"], 2)

        self.lobby["players"]["Host"]["image_ready"] = True
        state = game.send_state(self.code)
        self.assertEqual(state["phase"], "GUESSING")
        self.assertEqual(state["current_image_index"], 0)
        self.assertEqual(state["current_image"]["number"], 2)
        self.assertEqual(state["guessed_players"], [])
        self.assertIsNone(state["winner"])
        self.lobby["players"]["Alice"]["image_ready"] = True
        self.assertEqual(game.send_state(self.code)["current_image_index"], 0)
        self.guess("Alice")
        self.guess("Bob")
        self.now.return_value = 120
        self.assertEqual(game.send_state(self.code)["phase"], "REVEAL")
        self.pick()
        self.now.return_value = 124.9
        self.assertEqual(game.send_state(self.code)["current_image_index"], 0)
        self.now.return_value = 125
        state = game.send_state(self.code)
        self.assertEqual(state["current_image_index"], 1)
        self.assertEqual(state["current_image"]["number"], 3)
        self.guess("Host", index=1)
        self.guess("Bob", index=1)
        self.pick("Alice", "Host", index=1)
        self.now.return_value = 130
        self.assertEqual(game.send_state(self.code)["phase"], "GAME_OVER")
        self.assertEqual(self.lobby["shown_images"], [2, 0, 1])

    def test_all_images_advance_after_selection_and_finish(self):
        self.start()
        names = list(self.lobby["players"])
        for index, author in enumerate(names):
            eligible = [name for name in names if name != author]
            for name in eligible:
                self.guess(name, index=index)
            self.now.return_value += 10
            self.assertEqual(game.send_state(self.code)["phase"], "REVEAL")
            self.pick(author, eligible[0], index)
            self.now.return_value += 4.9
            self.assertEqual(game.send_state(self.code)["current_image_index"], index)
            self.now.return_value += 0.1
            state = game.send_state(self.code)
            self.assertEqual(state, game.send_state(self.code))
            if index < len(names) - 1:
                self.assertEqual(state["phase"], "GUESSING")
                self.assertEqual(state["current_image_index"], index + 1)
                self.assertEqual(state["current_image"]["username"], names[index + 1])
                self.assertEqual(state["guessed_players"], [])
                self.assertIsNone(state["winner"])
                with self.assertRaises(HTTPException):
                    self.pick(author, eligible[0], index)
            else:
                self.assertEqual(state["phase"], "GAME_OVER")
                self.assertIsNone(state["current_image"])
        self.assertEqual(state["scores"], {"Host": 2, "Alice": 1, "Bob": 0})


if __name__ == "__main__":
    unittest.main()
