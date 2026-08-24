from fastapi import FastAPI
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