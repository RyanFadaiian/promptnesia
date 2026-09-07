from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import math
import time
from threading import Lock

app = FastAPI(title="Prompnesia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

lobbies = {}
round_lock = Lock()


def new_player():
    return {"prompt": None, "image_url": None, "score": 0}


def submitted_players(lobby):
    return [
        username for username, player in lobby["players"].items()
        if player["prompt"] is not None
    ]


def update_prompting(lobby):
    if lobby["phase"] == "PROMPTING" and (
        time.monotonic() >= lobby["prompt_deadline"]
        or len(submitted_players(lobby)) == len(lobby["players"])
    ):
        lobby["phase"] = "GENERATING"
        for index, player in enumerate(lobby["players"].values()):
            player["image_url"] = f"/{index % 3 + 1}.png"
        lobby["current_image_index"] = 0
        lobby["phase"] = "GUESSING"


def update_guessing(lobby):
    if lobby["phase"] == "GUESSING":
        owner = list(lobby["players"])[lobby["current_image_index"]]
        guesses = lobby["guesses"].get(lobby["current_image_index"], {})
        if all(username in guesses for username in lobby["players"] if username != owner):
            lobby["phase"] = "REVEAL"
            if not guesses:
                lobby["next_image_at"] = time.monotonic() + 3


def update_reveal(lobby):
    with round_lock:
        if (lobby["phase"] == "REVEAL" and lobby["next_image_at"] is not None
                and time.monotonic() >= lobby["next_image_at"]):
            lobby["winner"] = None
            lobby["next_image_at"] = None
            if lobby["current_image_index"] + 1 < len(lobby["players"]):
                lobby["current_image_index"] += 1
                lobby["phase"] = "GUESSING"
            else:
                lobby["phase"] = "GAME_OVER"


class CreateLobbyRequest(BaseModel):
    username: str

class AddPlayerRequest(BaseModel):
    username: str

class ReturnToLobbyRequest(BaseModel):
    username: str

class AddPromptRequest(BaseModel):
    username: str
    prompt: str


class AddGuessRequest(BaseModel):
    username: str
    current_image_index: int
    guess: str


class PickWinnerRequest(BaseModel):
    username: str
    current_image_index: int
    winner: str


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/lobbies")
def create_lobby(request: CreateLobbyRequest):
    while True:
        lobby_id = random.randint(100000, 999999)
        if lobby_id not in lobbies:
            break

    lobbies[lobby_id] = {
        "id": lobby_id,
        "host": request.username,
        "players": {request.username: new_player()},
        "phase": "LOBBY",
        "current_image_index": 0,
        "guesses": {},
        "winner": None,
        "next_image_at": None,
    }

    return lobbies[lobby_id]


@app.post("/api/lobbies/{lobby_id}/players")
def join_lobby(lobby_id: int, request: AddPlayerRequest):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")
    elif request.username in lobbies[lobby_id]["players"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user has already chosen this username")
    if lobbies[lobby_id]["phase"] != "LOBBY":
        raise HTTPException(status_code=409, detail="Game has already started")
    lobbies[lobby_id]["players"][request.username] = new_player()

    return {"status": "joined"}


@app.get("/api/lobbies/{lobby_id}")
def retrieve_lobby(lobby_id: int):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")

    return {"players": list(lobbies[lobby_id]["players"]), "host": lobbies[lobby_id]["host"]}


@app.post("/api/lobbies/{lobby_id}/start")
def start_game(lobby_id: int):
    if lobby_id not in lobbies:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")

    if lobbies[lobby_id]["phase"] == "LOBBY":
        lobbies[lobby_id]["phase"] = "PROMPTING"
        lobbies[lobby_id]["prompt_deadline"] = time.monotonic() + 40
    return lobbies[lobby_id]["phase"]

@app.post("/api/lobbies/{lobby_id}/return")
def return_to_lobby(lobby_id: int, request: ReturnToLobbyRequest):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[lobby_id]
    with round_lock:
        if request.username != lobby["host"]:
            raise HTTPException(status_code=403, detail="Only the host can return to the lobby")
        if lobby["phase"] != "GAME_OVER":
            raise HTTPException(status_code=409, detail="The game is not over yet")
        lobby.update(
            phase="LOBBY",
            players={name: new_player() for name in lobby["players"]},
            current_image_index=0,
            guesses={},
            winner=None,
            next_image_at=None,
        )
        lobby.pop("prompt_deadline", None)
    return {"status": "returned"}


@app.get("/api/lobbies/{lobby_id}/state")
def send_state(lobby_id: int):
    if lobby_id not in lobbies:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")

    lobby = lobbies[lobby_id]
    update_prompting(lobby)
    update_reveal(lobby)
    update_guessing(lobby)
    guesses = lobby["guesses"].get(lobby["current_image_index"], {})
    current_image = None
    if lobby["phase"] in ("GUESSING", "REVEAL"):
        username = list(lobby["players"])[lobby["current_image_index"]]
        current_image = {
            "username": username,
            "image_url": lobby["players"][username]["image_url"],
        }
        if lobby["phase"] == "REVEAL":
            current_image["prompt"] = lobby["players"][username]["prompt"]
    return {
        "phase": lobby["phase"],
        "seconds_left": max(0, math.ceil(lobby["prompt_deadline"] - time.monotonic()))
        if lobby["phase"] == "PROMPTING" else 0,
        "submitted_players": submitted_players(lobby),
        "current_image_index": lobby["current_image_index"],
        "current_image": current_image,
        "guessed_players": list(guesses),
        "eligible_guessers": len(lobby["players"]) - 1,
        "guesses": guesses if lobby["phase"] == "REVEAL" else {},
        "winner": lobby["winner"],
        "scores": {name: player["score"] for name, player in lobby["players"].items()},
    }

@app.post("/api/lobbies/{lobby_id}/prompt")
def store_prompt(lobby_id: int, request: AddPromptRequest):
    if lobby_id not in lobbies:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")
    update_prompting(lobbies[lobby_id])
    if lobbies[lobby_id]["phase"] != "PROMPTING" or request.username not in lobbies[lobby_id]["players"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not right phase or player not in list")

    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    player = lobbies[lobby_id]["players"][request.username]
    if player["prompt"] is None:
        player["prompt"] = request.prompt.strip()
    update_prompting(lobbies[lobby_id])

    return {"status": "received"}


@app.post("/api/lobbies/{lobby_id}/guess")
def store_guess(lobby_id: int, request: AddGuessRequest):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[lobby_id]
    if lobby["phase"] != "GUESSING" or request.current_image_index != lobby["current_image_index"]:
        raise HTTPException(status_code=409, detail="This image is no longer accepting guesses")
    owner = list(lobby["players"])[lobby["current_image_index"]]
    if request.username not in lobby["players"] or request.username == owner:
        raise HTTPException(status_code=403, detail="You cannot guess this image")
    if not request.guess.strip():
        raise HTTPException(status_code=400, detail="Guess cannot be empty")

    guesses = lobby["guesses"].setdefault(lobby["current_image_index"], {})
    guesses.setdefault(request.username, request.guess.strip())
    update_guessing(lobby)
    return {"status": "received"}


@app.post("/api/lobbies/{lobby_id}/winner")
def pick_winner(lobby_id: int, request: PickWinnerRequest):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[lobby_id]
    with round_lock:
        if (lobby["phase"] != "REVEAL" or request.current_image_index != lobby["current_image_index"]
                or lobby["winner"] is not None):
            raise HTTPException(status_code=409, detail="This round is no longer accepting a winner")
        owner = list(lobby["players"])[lobby["current_image_index"]]
        if request.username != owner:
            raise HTTPException(status_code=403, detail="Only the prompt author can pick a winner")
        if request.winner not in lobby["guesses"].get(lobby["current_image_index"], {}):
            raise HTTPException(status_code=400, detail="Choose a player who submitted a guess")
        lobby["winner"] = request.winner
        lobby["players"][request.winner]["score"] += 1
        lobby["next_image_at"] = time.monotonic() + 3
    return {"status": "selected"}
