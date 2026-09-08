from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import random
import math
import time
from threading import Lock
from . import images

app = FastAPI(title="Prompnesia API")
app.mount("/generated", StaticFiles(directory=images.generated_dir), name="generated")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

lobbies = {}
round_lock = Lock()

DEFAULT_PROMPTS = [
    "A raccoon running a fancy restaurant",
    "A knight arguing with a parking meter",
    "A penguin attempting to rob a bank",
    "Average UCI student but make it funny",
    "Average UCLA student but make it funny"
]


def new_player():
    return {"prompt": None, "image_url": None, "image_ready": False, "score": 0}


def submitted_players(lobby):
    return [
        username for username, player in lobby["players"].items()
        if player["prompt"] is not None
    ]


def start_next_image(lobby):
    for index, player in enumerate(lobby["players"].values()):
        if player["image_ready"] and index not in lobby["shown_images"]:
            lobby["current_image_index"] = index
            lobby["shown_images"].append(index)
            lobby["winner"] = None
            lobby["next_image_at"] = None
            lobby["phase"] = "GUESSING"
            return


def update_prompting(lobby):
    with round_lock:
        if lobby["phase"] == "PROMPTING" and (
            time.monotonic() >= lobby["prompt_deadline"]
            or len(submitted_players(lobby)) == len(lobby["players"])
        ):
            lobby["phase"] = "GENERATING"
            for player in lobby["players"].values():
                if player["prompt"] is None:
                    player["prompt"] = random.choice(DEFAULT_PROMPTS)
                    images.image_queue.submit(images.generate_image, player)
        if lobby["phase"] == "GENERATING":
            start_next_image(lobby)


def update_guessing(lobby):
    if lobby["phase"] == "GUESSING":
        owner = list(lobby["players"])[lobby["current_image_index"]]
        guesses = lobby["guesses"].get(lobby["current_image_index"], {})
        if all(username in guesses for username in lobby["players"] if username != owner):
            lobby["phase"] = "REVEAL"
            if not guesses:
                lobby["next_image_at"] = time.monotonic() + 5


def update_reveal(lobby):
    with round_lock:
        if (lobby["phase"] == "REVEAL" and lobby["next_image_at"] is not None
                and time.monotonic() >= lobby["next_image_at"]):
            if len(lobby["shown_images"]) == len(lobby["players"]):
                lobby["phase"] = "GAME_OVER"
            else:
                start_next_image(lobby)


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
        "shown_images": [],
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
        if len(lobbies[lobby_id]["players"]) < 2:
            raise HTTPException(status_code=400, detail="You need at least 2 players to start the game!")
        for index, player in enumerate(lobbies[lobby_id]["players"].values()):
            player["image_url"] = f"/{index % 3 + 1}.png"
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
            shown_images=[],
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
            "number": len(lobby["shown_images"]),
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
    with round_lock:
        lobby = lobbies[lobby_id]
        if (lobby["phase"] != "PROMPTING" or request.username not in lobby["players"]
                or time.monotonic() >= lobby["prompt_deadline"]):
            raise HTTPException(status_code=404, detail="Not right phase or player not in list")
        player = lobby["players"][request.username]
        if player["prompt"] is None:
            player["prompt"] = request.prompt.strip() or random.choice(DEFAULT_PROMPTS) # second choice auto fills a prompt if empty
            images.image_queue.submit(images.generate_image, player)
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
        lobby["next_image_at"] = time.monotonic() + 5
    return {"status": "selected"}
