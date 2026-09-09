interface PromptingScreenProps {
  secondsLeft: number;
  submittedPlayers: string[];
  players: string[];
  prompt: string;
  submitted: boolean;
  draftError?: string;
  setPrompt: (prompt: string) => void;
  submitPrompt: () => Promise<void>;
}

export default function PromptingScreen({
  secondsLeft, submittedPlayers, players, prompt, submitted, setPrompt, submitPrompt, draftError
}: PromptingScreenProps) {
  return (
    <main className="App">
      <h1 className="heading">Write a prompt</h1>
      <p className="round-status">
        {secondsLeft}s remaining · {submittedPlayers.length} / {players.length} submitted
      </p>
      <p>Your prompt is saved as you type and submitted when time runs out.</p>
      {draftError && <p role="alert">{draftError}</p>}

      <form
        className="home-form form-panel"
        onSubmit={(event) => {
          event.preventDefault();
          submitPrompt().catch(console.error);
        }}
      >
        <label className="username-field">
          <input
            placeholder="Enter your prompt"
            aria-label="Your prompt"
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
