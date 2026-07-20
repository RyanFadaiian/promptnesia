import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router";

function HomePage() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      return;
    }

    navigate("/lobby/test", {
      state: { username: trimmedUsername },
    });
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

export default HomePage;