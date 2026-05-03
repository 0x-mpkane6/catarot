import { useEffect, useState } from "react";
import { motion as Motion } from "framer-motion";
import { Moon, Sparkle, Star } from "lucide-react";
import { usePreferencesStore } from "../../stores/preferencesStore";
import { useOracleStore } from "../../stores/oracleStore";

const positionLabels = {
  past: "Quá khứ",
  present: "Hiện tại",
  future: "Tương lai",
};

const flipLines = [
  "Đã đến lúc lật mở thông điệp.",
  "Ánh sáng vừa chạm vào lá bài...",
  "Đây là điều ngươi cần nhìn thấy.",
];

export default function TarotCard({ card, index = 0, revealed = false, interactive = true }) {
  const [flipped, setFlipped] = useState(false);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const orientation = card?.orientation === "reversed" ? "Ngược" : "Xuôi";
  const position = positionLabels[card?.position] || card?.position || positionLabels[["past", "present", "future"][index]];

  useEffect(() => {
    if (!revealed) {
      setFlipped(false);
      return;
    }
    const timer = window.setTimeout(() => setFlipped(true), reduceMotion ? 60 : 520 + index * 360);
    return () => window.clearTimeout(timer);
  }, [index, reduceMotion, revealed]);

  const handleFlip = () => {
    if (!interactive) return;
    if (!flipped) {
      setOracleState("revealing", flipLines[index % flipLines.length]);
    }
    setFlipped(true);
  };

  return (
    <Motion.button
      type="button"
      className={`tarot-card ${flipped ? "is-flipped" : ""} ${card?.orientation === "reversed" ? "is-reversed" : ""}`}
      onClick={handleFlip}
      initial={{ opacity: 0, y: 30, rotateY: -90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      whileHover={reduceMotion ? undefined : { y: -10, rotate: -1 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.55, delay: index * 0.12 }}
      aria-label={card?.name ? `${position}: ${card.name}` : `${position}: lá bài chưa lật`}
    >
      <span className="tarot-card-inner">
        <span className="tarot-face tarot-back">
          <Star size={22} />
          <span className="tarot-moon"><Moon size={32} /></span>
          <Sparkle size={18} />
        </span>
        <span className="tarot-face tarot-front">
          <small>{position}</small>
          <strong>{card?.name || "Lá bài ẩn"}</strong>
          {card?.name && <em>{orientation}</em>}
        </span>
      </span>
    </Motion.button>
  );
}
