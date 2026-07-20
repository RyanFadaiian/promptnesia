import { Navigate, useLocation } from "react-router";

interface LobbyLocationState {
  username?: string;
}

function LobbyPage() {
  const location = useLocation();
  const state = location.state as LobbyLocationState | null;
  const username = state?.username;

  if (!username) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="App">
      <h1 className="heading">Lobby</h1>

      <section className="lobby">
        <p>
          Lobby code: <strong>TEST</strong>
        </p>

        <p>Invite link: {window.location.href}</p>

        <h2>Players</h2>

        <ul>
          <li>{username} (Host)</li>
        </ul>

        <button className="play-button" type="button">
          Start
        </button>
      </section>
    </main>
  );
}

export default LobbyPage;