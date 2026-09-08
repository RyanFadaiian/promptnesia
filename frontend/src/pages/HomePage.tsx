import { api } from "../api";
import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router";

function HomePage() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      return;
    }

    try {
      const result = await api<{ id: number }>("/lobbies", "POST", { username: trimmedUsername });
      navigate(`/lobby/${result.id}`, {
        state: { username: trimmedUsername },
      });
    } catch (error) {
      console.error('Error sending POST request:', error);
    }
  }

  return (
    <main className="App home-page">
      <h1 className="heading">Prompnesia</h1>
      <p className="home-tagline">Write a prompt. Guess the picture. Pick the funniest answer.</p>
      <img className="home-mascot" src="/loading.gif" alt="A confused cat with a loading spinner" />

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
          Create Game
        </button>
      </form>
      <small className="music-credit">Music: Kevin MacLeod</small>
    </main>
  );
}

export default HomePage;
