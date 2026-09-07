import { Navigate, useLocation } from "react-router";
import { useParams } from 'react-router';
import { useEffect, useState } from "react";


interface LobbyLocationState {
  username?: string;
}

function LobbyPage() {
  const location = useLocation();
  const state = location.state as LobbyLocationState | null;
  const username = state?.username;

  const [copied, setCopied] = useState(false);
  const { lobbyId } = useParams();
  const inviteLink = `http://localhost:5173/join/${lobbyId}`;
  const [players, setPlayers] = useState<string[]>([]);
  const [host, setHost] = useState<string>();
  const [phase, setPhase] = useState("LOBBY");
  const [prompt, setPrompt] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(40);
  const [submittedPlayers, setSubmittedPlayers] = useState<string[]>([]);
  const submitted = submittedPlayers.includes(username ?? "");


  async function updatePlayers() {
    const response = await fetch(
      `http://127.0.0.1:8000/api/lobbies/${lobbyId}`
    );

    if (!response.ok) return;

    const result = await response.json();
    setPlayers(result.players);
    setHost(result.host);
  }

  useEffect(() => {
    updatePlayers().catch(console.error);
    updateState().catch(console.error);

    const interval = setInterval(() => {
      updatePlayers().catch(console.error);
      updateState().catch(console.error);
    }, 1000);

    return () => clearInterval(interval);
  }, [lobbyId]);

  async function handleCopyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  async function startGame() {
    const response = await fetch(
      `http://127.0.0.1:8000/api/lobbies/${lobbyId}/start`, {method: "POST",}
    );

    if (!response.ok) return;

    await updateState();
  }

  if (!username) {
    return <Navigate to="/" replace />;
  }

  async function updateState() {
    const response = await fetch(
      `http://127.0.0.1:8000/api/lobbies/${lobbyId}/state`
    );

    if (!response.ok) return;

    const result = await response.json();
    setPhase(result.phase);
    setSecondsLeft(result.seconds_left);
    setSubmittedPlayers(result.submitted_players);
  }

  async function submitPrompt() {
    if (!prompt.trim() || submitted || secondsLeft === 0) return;

    const response = await fetch(
      `http://127.0.0.1:8000/api/lobbies/${lobbyId}/prompt`, {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: username,
          prompt: prompt
        })
      }
    );
    if (!response.ok) {
      await updateState();
      return;
    }
    await updateState();
  }


  if (phase === "LOBBY") {
    return (
      <main className="App">
        <h1 className="heading">Lobby</h1>

        <section className="lobby">
          <p>
            Lobby code: <strong>{lobbyId}</strong>
          </p>

          <div className="invite-link">
            <input
              type="text"
              value={inviteLink}
              aria-label="Lobby invite link"
              readOnly
            />

            <button type="button" onClick={handleCopyInviteLink}>
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          <h2>Players</h2>

          <ul>
            {players.map((username) => {

              return username === host ? (
                <li key={username}>
                  {username} (Host)
                </li>
              ) : (
                <li key={username}>{username}</li>
              );
            })}
          </ul>

          {username === host ? (
            <button className="play-button" type="button" onClick={startGame}>Start</button>
          ) : null}
        </section>
      </main>
    );
  } else if (phase === "PROMPTING") {
    return (
      <main className="App">
        <h1 className="heading">Write a prompt</h1>
        <p style={{ color: "white", margin: "0 0 16px" }}>
          {secondsLeft}s remaining · {submittedPlayers.length} / {players.length} submitted
        </p>

        <form
          className="home-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitPrompt().catch(console.error);
          }}
        >
          <label className="username-field">
            <input
              placeholder="Enter your prompt"
              aria-label="Your prompt"
              required
              value={prompt}
              disabled={submitted || secondsLeft === 0}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>

          <button className="play-button" type="submit" disabled={submitted || secondsLeft === 0 || !prompt.trim()}>
            {submitted ? "Submitted" : "Submit"}
          </button>
        </form>
      </main>
    );
  } else if (phase === "PROMPTING_DONE") {
    return (
      <main className="App">
        <h1 className="heading">Prompting finished</h1>
      </main>
    );
  }
}

export default LobbyPage;
