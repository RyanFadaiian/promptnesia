import { useCallback, useEffect, useRef } from "react";

const songs = Object.values(
  import.meta.glob("/src/music/*.mp3", {
    eager: true,
    query: "?url",
    import: "default",
  })
);

export default function MusicPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const remaining = useRef<string[]>([]);
  const current = useRef("");

  const nextSong = useCallback(() => {
    if (!audio.current) return;
    if (!remaining.current.length) remaining.current = [...songs];
    const choices = remaining.current.filter((song) => song !== current.current);
    const song = choices[Math.floor(Math.random() * choices.length)];
    remaining.current = remaining.current.filter((item) => item !== song);
    current.current = song;
    audio.current.src = song;
    audio.current.play().catch(() => {});
  }, []);

  useEffect(() => {
    const player = audio.current!;
    player.volume = 0.2;
    // Browsers require a user interaction before playing music.
    const start = () => {
      if (!player.getAttribute("src")) nextSong();
      else if (player.paused) player.play().catch(() => {});
    };
    document.addEventListener("pointerdown", start);
    document.addEventListener("keydown", start);
    return () => {
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("keydown", start);
      player.pause();
    };
  }, [nextSong]);

  return (
    <div className="music-player">
      <audio ref={audio} onEnded={nextSong} />
      <label htmlFor="music-volume">Music</label>
      <input
        id="music-volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        defaultValue="0.2"
        aria-label="Music volume"
        onChange={(event) => {
          if (audio.current) audio.current.volume = Number(event.target.value);
        }}
      />
      <button type="button" onClick={nextSong} aria-label="Skip song">Skip</button>
    </div>
  );
}
