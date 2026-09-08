import { useState } from "react";

interface LobbyScreenProps {
  lobbyId?: string;
  inviteLink: string;
  copied: boolean;
  players: string[];
  host?: string;
  username: string;
  handleCopyInviteLink: () => Promise<void>;
  startGame: () => Promise<void>;
}

export default function LobbyScreen({
  lobbyId, inviteLink, copied, players, host, username, handleCopyInviteLink, startGame
}: LobbyScreenProps) {
  const [showStartError, setShowStartError] = useState(false);

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

        {showStartError && players.length < 2 && (
          <p role="alert"><strong>You need at least 2 players to start the game!</strong></p>
        )}

        {username === host ? (
          <button className="play-button" type="button" onClick={() => {
            if (players.length < 2) {
              setShowStartError(true);
              return;
            }
            setShowStartError(false);
            startGame();
          }}>Start</button>
        ) : null}
      </section>
    </main>
  );
}
