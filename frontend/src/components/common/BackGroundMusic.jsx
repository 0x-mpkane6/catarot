import { useEffect, useRef } from "react";

import backgroundMusic from "../../assets/audio/background-music.mp3";

export default function BackGroundMusic() {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    let hasStarted = false;

    const tryPlay = async () => {
      if (hasStarted) return;

      try {
        await audio.play();
        hasStarted = true;
      } catch {
        // Trình duyệt có thể chặn autoplay cho đến khi người dùng tương tác.
      }
    };

    tryPlay();

    const resumeOnInteraction = () => {
      tryPlay();
    };

    window.addEventListener("pointerdown", resumeOnInteraction);
    window.addEventListener("keydown", resumeOnInteraction);

    return () => {
      window.removeEventListener("pointerdown", resumeOnInteraction);
      window.removeEventListener("keydown", resumeOnInteraction);
      audio.pause();
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      src={backgroundMusic}
      autoPlay
      loop
      preload="auto"
      style={{ display: "none" }}
    />
  );
}
