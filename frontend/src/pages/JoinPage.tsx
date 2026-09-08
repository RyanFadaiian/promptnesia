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

    const url = `http://127.0.0.1:8000/api/lobbies/${lobbyId}/players`;
  
    const data = { 
      username: trimmedUsername, 
    };

    setJoining(true);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const result = await response.json();
        setError(typeof result.detail === "string" ? result.detail : "Could not join the lobby. Please try again.");
        return;
      }

      navigate(`/lobby/${lobbyId}`, {
        state: { username: trimmedUsername },
      });
    } catch {
      setError("Could not connect to the server. Please try again.");
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
