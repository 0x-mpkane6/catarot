import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useOracleStore } from "../../stores/oracleStore";
import { usePreferencesStore } from "../../stores/preferencesStore";

const stateLabel = {
  idle: "Tĩnh lặng",
  welcome: "Chào đón",
  listening: "Lắng nghe",
  thinking: "Suy ngẫm",
  drawing: "Rút bài",
  revealing: "Lật bài",
  speaking: "Cất lời",
  celebrating: "Hân hoan",
  warning: "Cảnh báo",
  sleeping: "Ngủ yên",
};

const bubbleClassByState = {
  thinking: "bubble-thinking",
  drawing: "bubble-thinking",
  listening: "bubble-listening",
  revealing: "bubble-revealing",
  celebrating: "bubble-celebrating",
};

export default function OracleDialogue() {
  const dialogue = useOracleStore((state) => state.dialogue);
  const oracleState = useOracleStore((state) => state.state);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);
  const [visibleText, setVisibleText] = useState(dialogue);
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (reduceMotion) {
      setVisibleText(dialogue);
      setDone(true);
      return undefined;
    }
    setVisibleText("");
    setDone(false);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(dialogue.slice(0, index));
      if (index >= dialogue.length) {
        window.clearInterval(timer);
        setDone(true);
      }
    }, 24);
    return () => window.clearInterval(timer);
  }, [dialogue, reduceMotion]);

  const bubbleClass = bubbleClassByState[oracleState] || "";

  return (
    <div
      key={dialogue}
      className={`oracle-dialogue dialogue-${oracleState} ${bubbleClass}`}
      role="status"
      aria-live="polite"
    >
      <Sparkles size={16} />
      <p>
        {visibleText}
        {!done && <span className="bubble-caret">▍</span>}
      </p>
      <span className="oracle-state-badge" aria-hidden="true">
        <span className="pulse-dot" /> {stateLabel[oracleState] || "Oracle"}
      </span>
    </div>
  );
}
