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
  rounds: number;
  changeRounds: (rounds: number) => Promise<void>;
  savingRounds: boolean;
  roundsError: string;
}

export default function LobbyScreen({
  lobbyId, inviteLink, copied, players, host, username, handleCopyInviteLink, startGame,
  rounds, changeRounds, savingRounds, roundsError
}: LobbyScreenProps) {
  const [showStartError, setShowStartError] = useState(false);
  const [draftRounds, setDraftRounds] = useState<number | null>(null);

  async function saveRounds() {
    if (draftRounds === null || savingRounds) return;
    try {
      if (draftRounds !== rounds) await changeRounds(draftRounds);
    } finally {
      setDraftRounds(null);
    }
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

        <label className="rounds-setting">
          <span>Rounds: {draftRounds ?? rounds}</span>
          <input type="range" min="1" max="3" step="1" value={draftRounds ?? rounds}
            aria-label="Number of rounds"
            disabled={username !== host || savingRounds}
            onChange={(event) => setDraftRounds(Number(event.target.value))}
            onPointerUp={() => void saveRounds()}
            onPointerCancel={() => setDraftRounds(null)}
            onKeyUp={() => void saveRounds()} />
        </label>
        {roundsError && <p role="alert">{roundsError}</p>}

        {showStartError && players.length < 2 && (
          <p role="alert"><strong>You need at least 2 players to start the game!</strong></p>
        )}

        {username === host ? (
          <button className="play-button" type="button" disabled={savingRounds} onClick={() => {
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
