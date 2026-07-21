import { useState } from "react";
import { Navigate, useLocation } from "react-router";


interface LobbyLocationState {
  username?: string;
}

function LobbyPage() {
  const location = useLocation();
  const state = location.state as LobbyLocationState | null;
  const username = state?.username;

  const [copied, setCopied] = useState(false);
  const inviteLink = window.location.href;

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