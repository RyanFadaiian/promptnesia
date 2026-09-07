from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import math
import time

app = FastAPI(title="Prompnesia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

lobbies = {}


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


class CreateLobbyRequest(BaseModel):
    username: str

class AddPlayerRequest(BaseModel):
    username: str

class AddPromptRequest(BaseModel):
    username: str
    prompt: str


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
    }

    return lobbies[lobby_id]


@app.post("/api/lobbies/{lobby_id}/players")
def join_lobby(lobby_id: int, request: AddPlayerRequest):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")
    elif request.username in lobbies[lobby_id]["players"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user has already chosen this username")
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

@app.get("/api/lobbies/{lobby_id}/state")
def send_state(lobby_id: int):
    if lobby_id not in lobbies:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")

    lobby = lobbies[lobby_id]
    update_prompting(lobby)
    current_image = None
    if lobby["phase"] == "GUESSING":
        username = list(lobby["players"])[lobby["current_image_index"]]
        current_image = {
            "username": username,
            "image_url": lobby["players"][username]["image_url"],
        }
    return {
        "phase": lobby["phase"],
        "seconds_left": max(0, math.ceil(lobby["prompt_deadline"] - time.monotonic()))
        if lobby["phase"] == "PROMPTING" else 0,
        "submitted_players": submitted_players(lobby),
        "current_image_index": lobby["current_image_index"],
        "current_image": current_image,
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
