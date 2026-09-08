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
}
