from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random

app = FastAPI(title="Prompnesia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

lobbies = {}


class CreateLobbyRequest(BaseModel):
    username: str

class AddPlayerRequest(BaseModel):
    username: str


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
        "players": [request.username],
        "phase": "LOBBY",
    }

    return lobbies[lobby_id]


@app.post("/api/lobbies/{lobby_id}/players")
def join_lobby(lobby_id: int, request: AddPlayerRequest):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")
    elif request.username in lobbies[lobby_id]["players"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user has already chosen this username")
    lobbies[lobby_id]["players"].append(request.username)

    return {"status": "joined"}


@app.get("/api/lobbies/{lobby_id}")
def retrieve_lobby(lobby_id: int):
    if lobby_id not in lobbies:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lobby not found")

    print("LOBBY DATA:", lobbies[lobby_id])
    
    return {"players": lobbies[lobby_id]["players"], "host": lobbies[lobby_id]["host"]}


@app.get("/api/lobbies/{lobby_id}/start")
def start_game(lobby_id: int):
    pass