import { Route, Routes } from "react-router";
import "./App.css";
import HomePage from "./pages/HomePage";
import LobbyPage from "./pages/LobbyPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
    </Routes>
  );
}

export default App;