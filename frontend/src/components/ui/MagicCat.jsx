import { useEffect, useMemo, useState } from "react";

import magicCat from "../../assets/images/homepage/magic-cat.png";
import catSound from "../../assets/sounds/homepage/magic-cat.mp3";

import SpeechBubble from "./SpeechBubble";

import "./MagicCat.css";

const DIALOGUES = [
  "The stars whisper tonight.",
  "Your fate smells interesting.",
  "Another reading awaits.",
  "Do not ignore the moon.",
  "The cards remember everything.",
  "A strange energy surrounds you.",
  "The arcana are restless.",
  "Your destiny shifts slowly.",
  "Even silence tells a story.",
  "The universe is listening.",
];

export default function MagicCat({
  onClick,
}) {

  const [message, setMessage] =
    useState("Welcome back.");

  const [visible, setVisible] =
    useState(true);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const randomizedDialogues = useMemo(() => {

    return [...DIALOGUES]
      .sort(() => Math.random() - 0.5);

  }, []);

  const [canMeow, setCanMeow] = useState(true);

  const handleCatClick = () => {

    if (!canMeow) return;

    setCanMeow(false);

    const audio = new Audio(catSound);

    audio.volume = 0.7;

    audio.play();

    onClick?.();

    setTimeout(() => {

        setCanMeow(true);

    }, 10000);
    };

  useEffect(() => {

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 10000);

    return () => clearTimeout(hideTimer);

  }, []);

  useEffect(() => {

    const interval = setInterval(() => {

      const nextMessage =
        randomizedDialogues[
          currentIndex % randomizedDialogues.length
        ];

      setMessage(nextMessage);

      setVisible(true);

      setTimeout(() => {
        setVisible(false);
      }, 10000);

      setCurrentIndex((prev) => prev + 1);

    }, 45000);

    return () => clearInterval(interval);

  }, [currentIndex, randomizedDialogues]);

  return (
    <div
      className="magic-cat-container"
      onClick={handleCatClick}
    >

      <SpeechBubble
        text={message}
        visible={visible}
      />

      <div className="magic-cat-glow" />

      <img
        src={magicCat}
        alt="Magic Cat"
        className="magic-cat-image"
      />
    </div>
  );
}