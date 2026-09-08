import { api } from "../api";
import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router";
import { useParams } from 'react-router';

function JoinPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();
  const { lobbyId } = useParams();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joining) return;
    setError("");

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Enter a username to join.");
      return;
    }

    setJoining(true);
    try {
      await api(`/lobbies/${lobbyId}/players`, "POST", { username: trimmedUsername });
      navigate(`/lobby/${lobbyId}`, {
        state: { username: trimmedUsername },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not join the lobby. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="App">
      <h1 className="heading">Prompnesia</h1>

      <form className="home-form" onSubmit={handleSubmit}>
        <label className="username-field">
          <input
            type="text"
            name="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError("");
            }}
            disabled={joining}
            aria-label="Username"
            aria-describedby={error ? "join-error" : undefined}
            placeholder="Enter your username"
            autoComplete="username"
          />
        </label>

        {error && <p id="join-error" role="alert" style={{ color: "white", margin: 0, textAlign: "center" }}>{error}</p>}

        <button className="play-button" type="submit" disabled={joining}>
          {joining ? "Joining..." : "Play!"}
        </button>
      </form>
    </main>
  );
}

export default JoinPage;
