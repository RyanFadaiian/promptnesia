interface GameOverScreenProps {
  scores: Record<string, number>;
  username: string;
  host?: string;
  submittingRound: boolean;
  roundError: string;
  returnToLobby: () => Promise<void>;
}

export default function GameOverScreen({
  scores, username, host, submittingRound, roundError, returnToLobby
}: GameOverScreenProps) {
  return (
    <main className="App">
      <h1 className="heading">Final scores</h1>
      <section className="lobby">
        <ul>
          {Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([player, score]) => (
            <li key={player}><strong>{player}:</strong> {score}</li>
          ))}
        </ul>
        {username === host ? (
          <button className="play-button" type="button" disabled={submittingRound} onClick={returnToLobby}>
            Return to Lobby
          </button>
        ) : null}
        {roundError && <p role="alert">{roundError}</p>}
      </section>
    </main>
  );
}
