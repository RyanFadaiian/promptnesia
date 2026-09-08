export interface CurrentImage {
  number: number;
  username: string;
  image_url: string;
  prompt?: string | null;
}

interface GuessingScreenProps {
  phase: "GUESSING" | "REVEAL";
  currentImage: CurrentImage;
  currentImageIndex: number;
  players: string[];
  username: string;
  guesses: Record<string, string>;
  winner: string | null;
  submittingRound: boolean;
  roundError: string;
  guessedPlayers: string[];
  eligibleGuessers: number;
  guessed: boolean;
  submitRound: (action: "guess" | "winner", value: string) => Promise<void>;
}

export default function GuessingScreen({
  phase, currentImage, currentImageIndex, players, username, guesses, winner, submittingRound, roundError, guessedPlayers, eligibleGuessers, guessed, submitRound
}: GuessingScreenProps) {
  return (
    <main className="App">
      <h1 className="heading">{phase === "REVEAL" ? "The original prompt" : "Guess the prompt"}</h1>
      <p style={{ color: "white", margin: "0 0 16px" }}>
        Image {currentImage.number} of {players.length}
      </p>

      <section className="home-form">
        <img
          className="guessing-image"
          src={currentImage.image_url}
          alt="Image for the current guessing round"
        />
        {phase === "REVEAL" ? (
          <section className="lobby" style={{ marginTop: 16 }}>
            <p><strong>{currentImage.username}:</strong> {currentImage.prompt ?? "No prompt submitted"}</p>
            <h2>Guesses</h2>
            {winner ? (
              <p role="status"><strong>{winner} wins 1 point!</strong> Moving on in a few seconds...</p>
            ) : Object.keys(guesses).length > 0 ? (
              <p>{currentImage.username === username ? "Pick your favorite guess." : `${currentImage.username} is picking a favorite.`}</p>
            ) : null}
            {Object.keys(guesses).length === 0 ? <p>No guesses.</p> : (
              <ul>
                {Object.entries(guesses).map(([player, guess]) => (
                  <li key={player}>
                    <strong>{player}:</strong> {guess}
                    {currentImage.username === username && !winner && (
                      <button
                        className="play-button"
                        type="button"
                        disabled={submittingRound}
                        onClick={() => void submitRound("winner", player)}
                      >
                        Pick winner
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {roundError && <p role="alert">{roundError}</p>}
          </section>
        ) : (
          <>
            <p style={{ color: "white" }} aria-live="polite">
              {guessedPlayers.length} / {eligibleGuessers} guessed
            </p>
            {currentImage.username === username ? (
              <p style={{ color: "white" }}>Your image — other players are guessing.</p>
            ) : (
              <form
                className="home-form"
                key={currentImageIndex}
                onSubmit={(event) => {
                  event.preventDefault();
                  const guess = new FormData(event.currentTarget).get("guess") as string;
                  void submitRound("guess", guess);
                }}
              >
                <label className="username-field">
                  <input
                    name="guess"
                    required
                    pattern=".*\S.*"
                    disabled={guessed || submittingRound}
                    aria-label="Your guess"
                    placeholder="What was the original prompt?"
                    autoComplete="off"
                  />
                </label>
                <button className="play-button" type="submit" disabled={guessed || submittingRound}>
                  {guessed ? "Submitted" : submittingRound ? "Submitting..." : "Submit"}
                </button>
                {roundError && <p role="alert" style={{ color: "white" }}>{roundError}</p>}
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
