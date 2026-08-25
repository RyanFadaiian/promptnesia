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

    const interval = setInterval(() => {
      updatePlayers().catch(console.error);
    }, 2000);

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

  if (!username) {
    return <Navigate to="/" replace />;
  }

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
          <button className="play-button" type="button">Start</button>
        ) : null}
      </section>
    </main>
  );
}

export default LobbyPage;