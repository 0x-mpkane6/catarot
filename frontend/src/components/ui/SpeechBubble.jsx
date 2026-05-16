import ScrambledText from "./ScrambledText";

import "./SpeechBubble.css";

export default function SpeechBubble({
  text,
  visible,
}) {
  return (
    <div
      className={`speech-bubble ${
        visible ? "show" : ""
      }`}
    >
      <ScrambledText>
        {text}
      </ScrambledText>
    </div>
  );
}