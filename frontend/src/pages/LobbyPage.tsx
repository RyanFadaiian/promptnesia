import { Navigate, useLocation } from "react-router";
import { useParams } from 'react-router';
import { useEffect, useState } from "react";


interface LobbyLocationState {
  username?: string;
}

interface CurrentImage {
  username: string;
  image_url: string;
  prompt?: string | null;
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState<CurrentImage | null>(null);
  const [guessedPlayers, setGuessedPlayers] = useState<string[]>([]);
  const [eligibleGuessers, setEligibleGuessers] = useState(0);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submittingRound, setSubmittingRound] = useState(false);
  const [roundError, setRoundError] = useState("");
  const guessed = guessedPlayers.includes(username ?? "");
  const submitted = submittedPlayers.includes(username ?? "");

  useEffect(() => {
    setRoundError("");
  }, [currentImageIndex]);

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
    setCurrentImageIndex(result.current_image_index);
    setCurrentImage(result.current_image);
    setGuessedPlayers(result.guessed_players);
    setEligibleGuessers(result.eligible_guessers);
    setGuesses(result.guesses);
    setWinner(result.winner);
    setScores(result.scores);
    if (result.phase === "LOBBY") {
      setPrompt("");
      setRoundError("");
    }
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


  async function submitRound(action: "guess" | "winner", value: string) {
    if (!value.trim() || submittingRound || (action === "guess" ? guessed : winner)) return;
    setSubmittingRound(true);
    setRoundError("");
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/lobbies/${lobbyId}/${action}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, current_image_index: currentImageIndex, [action]: value }),
      });
      if (!response.ok) {
        const result = await response.json();
        setRoundError(result.detail || "Could not submit. Please try again.");
      }
      await updateState();
    } catch {
      setRoundError("Could not submit. Please try again.");
    } finally {
      setSubmittingRound(false);
    }
  }

  async function returnToLobby() {
    setSubmittingRound(true);
    setRoundError("");
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/lobbies/${lobbyId}/return`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username }),
      });
      if (!response.ok) throw new Error("Could not return to lobby");
      await updateState();
    } catch {
      setRoundError("Could not return to lobby. Please try again.");
    } finally {
      setSubmittingRound(false);
    }
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
  } else if (phase === "GENERATING") {
    return (
      <main className="App">
        <h1 className="heading">Generating images</h1>
      </main>
    );
  } else if ((phase === "GUESSING" || phase === "REVEAL") && currentImage) {
    return (
      <main className="App">
        <h1 className="heading">{phase === "REVEAL" ? "The original prompt" : "Guess the prompt"}</h1>
        <p style={{ color: "white", margin: "0 0 16px" }}>
          Image {currentImageIndex + 1} of {players.length}
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
  } else if (phase === "GAME_OVER") {
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
}

export default LobbyPage;
