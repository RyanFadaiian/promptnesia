import "./App.css";
import { useState } from "react";

const App: React.FC = () => {
  const [username, setUsername] = useState("");

  return <div className="App">

    <span className="heading">Prompnesia</span>

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

    <button className="play-button" type="button">
      Play!
    </button>

  </div>

}

export default App;
