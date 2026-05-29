import {
  useEffect,
  useState,
} from "react";

import magicCat from "../../assets/images/homepage/magic-cat.png";
import catSound from "../../assets/sounds/homepage/magic-cat.mp3";

import SpeechBubble from "./SpeechBubble";

import "./MagicCat.css";

export default function MagicCat({
  onClick,
}) {

  const [message] =
    useState("Welcome back.");

  const [visible, setVisible] =
    useState(true);

  const [canMeow, setCanMeow] = useState(true);

  const handleCatClick = () => {
    onClick?.();

    if (!canMeow) return;

    setCanMeow(false);

    const audio = new Audio(catSound);

    audio.volume = 1.0;

    audio.play();

    setTimeout(() => {
      setCanMeow(true);
    }, 8000);
  };

  useEffect(() => {

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 10000);

    return () => clearTimeout(hideTimer);

  }, []);

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
