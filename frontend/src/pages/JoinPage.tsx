import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router";
import { useParams } from 'react-router';

function JoinPage() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const { lobbyId } = useParams();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      return;
    }

    const url = `http://127.0.0.1:8000/api/lobbies/${lobbyId}/players`;
  
    const data = { 
      username: trimmedUsername, 
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      navigate(`/lobby/${lobbyId}`, {
        state: { username: trimmedUsername },
      });
    } catch (error) {
      console.error('Error sending POST request:', error);
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
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />
        </label>

        <button className="play-button" type="submit">
          Play!
        </button>
      </form>
    </main>
  );
}

export default JoinPage;