import { useEffect, useRef } from "react";

import backgroundMusic from "../../assets/audio/background-music.mp3";
import { useAppSettings } from "../../context/AppSettingsContext";

export default function BackGroundMusic() {
  const audioRef = useRef(null);
  const { settings } = useAppSettings();

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextVolume = Number(settings.backgroundMusicVolume);
    audio.volume = Number.isFinite(nextVolume)
      ? Math.min(1, Math.max(0, nextVolume))
      : 0.35;
  }, [settings.backgroundMusicVolume]);

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
