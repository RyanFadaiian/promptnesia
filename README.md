# Promptnesia

A multiplayer browser game where friends write prompts, guess what inspired an AI-generated image, and pick their favorite answers.

**[Play the game](https://promptnesia-brown.vercel.app)** — (Minimum is 2 players to start a game. If you'd like to test it yourself you can run 2 instances).

## How to play

1. Create a lobby and share the invite link. The host chooses 1–3 rounds.
2. Everyone has 40 seconds to write an image prompt. Drafts save as you type, so the latest saved text is used if time runs out before you submit. Empty prompts get a random suggestion.
3. Images appear one at a time. Everyone except the prompt author guesses the original prompt.
4. Once everyone has guessed, the prompt is revealed. Its author picks their favorite guess, earning that player one point.
5. After all rounds, compare scores and return to the lobby for another game.

## Built with

- **Frontend:** React, TypeScript, Vite, and React Router
- **Backend:** Python, FastAPI, and OpenAI image generation
- **Hosting:** Vercel for the frontend and Render for the backend
- **Testing:** Vitest, React Testing Library, and Python unittest

The backend manages the game phases, deadlines, and scores. Clients poll for updates every second, while image generation runs in a background thread pool. Ready images can enter the guessing phase while others are still generating.

Draft saving came from playtesting with friends: players would finish writing but forget to press Submit before the timer expired. Draft revisions prevent an older request from overwriting newer text.

## Run locally

You'll need Node.js with npm, Python with pip, and an OpenAI API key with access to the models used in `backend/app/images.py`. Playing locally makes paid API requests; the tests mock them.

From the repository root, set up the backend:

```sh
cd backend
python -m venv .venv
```

Activate the environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```sh
# macOS / Linux
source .venv/bin/activate
```

Copy `backend/.env.example` to `backend/.env` and replace the placeholder `OPENAI_API_KEY` with your key. Keep the other values for local development. Then, from `backend/`:

```sh
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

In a second terminal, from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The frontend defaults to the local backend at `http://127.0.0.1:8000`. To use a different backend, copy `frontend/.env.example` to `frontend/.env` and change `VITE_API_URL`.

## Run the backend with Docker

With Docker installed and running, configure `backend/.env` as above, then run these commands from the repository root:

```sh
docker build -t promptnesia-api ./backend
docker run --rm --name promptnesia-api -p 8000:8000 --env-file backend/.env promptnesia-api
```

Use `PORT=8000` for this local port mapping if you have set it in your environment file. Start the frontend separately with `npm --prefix frontend run dev`, and check the backend at `http://localhost:8000/api/health`.

The image uses Python 3.11, runs as a non-root user, and excludes local secrets, virtual environments, and generated images. Environment variables are supplied when the container starts. Removing the container removes its generated images; restarting the process clears lobbies.

For a Render Docker web service, set the root directory to `backend` and Dockerfile path to `./Dockerfile`. Use the image's default start command, set the health check to `/api/health`, and supply the backend environment variables listed below. The container listens on Render's `PORT`. The frontend stays on Vercel.

## Tests

From the repository root, with the backend virtual environment active:

```sh
npm --prefix frontend test
python -m unittest discover -s backend/tests -t backend
npm --prefix frontend run build
npm --prefix frontend run lint
```

Tests cover game progression, scoring, image generation, draft timeouts, and frontend interactions. See [TESTING.md](TESTING.md) for more details.

## Deployment notes

Set Vercel's root directory to `frontend`, with `npm run build` as the build command and `dist` as the output directory. The included `vercel.json` handles direct invite links.

Run the backend from `backend/` with one worker:

```sh
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

| Variable | Where | Value |
| --- | --- | --- |
| `VITE_API_URL` | Vercel | Backend HTTPS URL ending in `/api` |
| `OPENAI_API_KEY` | Render | Your private API key |
| `BACKEND_PUBLIC_URL` | Render | Backend HTTPS origin, without `/api` |
| `FRONTEND_ORIGINS` | Render | Comma-separated allowed frontend origins |

Lobbies are currently stored in memory and generated images on local disk. Run a single backend instance; restarting it clears active games. Shared game storage and persistent image storage would be needed to scale across instances.

Music by Kevin MacLeod.
