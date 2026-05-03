import { motion as Motion } from "framer-motion";
import { usePreferencesStore } from "../../stores/preferencesStore";

const cards = ["Mặt trăng", "Ngôi sao", "Mặt trời"];

export default function FloatingTarotCards() {
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);

  return (
    <div className="oracle-floating-cards" aria-hidden="true">
      {cards.map((label, index) => (
        <Motion.div
          key={label}
          className={`mini-tarot mini-tarot-${index + 1}`}
          animate={
            reduceMotion
              ? { opacity: 0.86 }
              : {
                  y: [0, -16, 0],
                  rotate: [-4 + index, 5 - index, -4 + index],
                }
          }
          transition={{
            duration: 4.8 + index * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.35,
          }}
        >
          <span />
        </Motion.div>
      ))}
    </div>
  );
}
