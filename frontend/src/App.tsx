import { Route, Routes } from "react-router";
import "./App.css";
import HomePage from "./pages/HomePage";
import LobbyPage from "./pages/LobbyPage";
import JoinPage from "./pages/JoinPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/join/:lobbyId" element={<JoinPage />} />
      <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
    </Routes>
  );
}

export default App;