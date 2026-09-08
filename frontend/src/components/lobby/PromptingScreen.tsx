interface PromptingScreenProps {
  secondsLeft: number;
  submittedPlayers: string[];
  players: string[];
  prompt: string;
  submitted: boolean;
  setPrompt: (prompt: string) => void;
  submitPrompt: () => Promise<void>;
}

export default function PromptingScreen({
  secondsLeft, submittedPlayers, players, prompt, submitted, setPrompt, submitPrompt
}: PromptingScreenProps) {
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

        <button className="play-button" type="submit" disabled={submitted || secondsLeft === 0}>
          {submitted ? "Submitted" : "Submit"}
        </button>
      </form>
    </main>
  );
}
