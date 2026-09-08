import LobbyScreen from "../components/lobby/LobbyScreen";
import PromptingScreen from "../components/lobby/PromptingScreen";
import GuessingScreen from "../components/lobby/GuessingScreen";
import GameOverScreen from "../components/lobby/GameOverScreen";
import type { CurrentImage } from "../components/lobby/GuessingScreen";
import { api } from "../api";
import { Navigate, useLocation } from "react-router";
import { useParams } from 'react-router';
import { useCallback, useEffect, useState } from "react";


interface LobbyLocationState {
  username?: string;
}

interface LobbyState {
  phase: string;
  seconds_left: number;
  submitted_players: string[];
  current_image_index: number;
  current_image: CurrentImage | null;
  guessed_players: string[];
  eligible_guessers: number;
  guesses: Record<string, string>;
  winner: string | null;
  scores: Record<string, number>;
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

  const updatePlayers = useCallback(async () => {
    const result = await api<{ players: string[]; host: string }>(`/lobbies/${lobbyId}`);
    setPlayers(result.players);
    setHost(result.host);
  }, [lobbyId]);

  const updateState = useCallback(async () => {
    const result = await api<LobbyState>(`/lobbies/${lobbyId}/state`);
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
  }, [lobbyId]);

  useEffect(() => {
    updatePlayers().catch(console.error);
    updateState().catch(console.error);

    const interval = setInterval(() => {
      updatePlayers().catch(console.error);
      updateState().catch(console.error);
    }, 1000);

    return () => clearInterval(interval);
  }, [updatePlayers, updateState]);

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
    try {
      await api(`/lobbies/${lobbyId}/start`, "POST");
      await updateState();
    } catch (error) {
      console.error(error);
    }
  }

  if (!username) {
    return <Navigate to="/" replace />;
  }

  async function submitPrompt() {
    if (submitted || secondsLeft === 0) return;

    try {
      await api(`/lobbies/${lobbyId}/prompt`, "POST", { username, prompt });
    } finally {
      await updateState();
    }
  }


  async function submitRound(action: "guess" | "winner", value: string) {
    if (!value.trim() || submittingRound || (action === "guess" ? guessed : winner)) return;
    setSubmittingRound(true);
    setRoundError("");
    try {
      try {
        await api(`/lobbies/${lobbyId}/${action}`, "POST", {
          username, current_image_index: currentImageIndex, [action]: value,
        });
      } finally {
        await updateState();
      }
    } catch (error) {
      setRoundError(error instanceof Error ? error.message : "Could not submit. Please try again.");
    } finally {
      setSubmittingRound(false);
    }
  }

  async function returnToLobby() {
    setSubmittingRound(true);
    setRoundError("");
    try {
      await api(`/lobbies/${lobbyId}/return`, "POST", { username });
      await updateState();
    } catch (error) {
      setRoundError(error instanceof Error ? error.message : "Could not return to lobby. Please try again.");
    } finally {
      setSubmittingRound(false);
    }
  }

  if (phase === "LOBBY") {
    return (
      <LobbyScreen
        lobbyId={lobbyId}
        inviteLink={inviteLink}
        copied={copied}
        players={players}
        host={host}
        username={username}
        handleCopyInviteLink={handleCopyInviteLink}
        startGame={startGame}
      />
    );
  } else if (phase === "PROMPTING") {
    return (
      <PromptingScreen
        secondsLeft={secondsLeft}
        submittedPlayers={submittedPlayers}
        players={players}
        prompt={prompt}
        submitted={submitted}
        setPrompt={setPrompt}
        submitPrompt={submitPrompt}
      />
    );
  } else if (phase === "GENERATING") {
    return (
      <main className="App">
        <h1 className="heading">Generating images</h1>
      </main>
    );
  } else if ((phase === "GUESSING" || phase === "REVEAL") && currentImage) {
    return (
      <GuessingScreen
        phase={phase}
        currentImage={currentImage}
        currentImageIndex={currentImageIndex}
        players={players}
        username={username}
        guesses={guesses}
        winner={winner}
        submittingRound={submittingRound}
        roundError={roundError}
        guessedPlayers={guessedPlayers}
        eligibleGuessers={eligibleGuessers}
        guessed={guessed}
        submitRound={submitRound}
      />
    );
  } else if (phase === "GAME_OVER") {
    return (
      <GameOverScreen
        scores={scores}
        username={username}
        host={host}
        submittingRound={submittingRound}
        roundError={roundError}
        returnToLobby={returnToLobby}
      />
    );
  }
}

export default LobbyPage;
