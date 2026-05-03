import { motion as Motion } from "framer-motion";
import { useOracleStore } from "../../stores/oracleStore";
import { usePreferencesStore } from "../../stores/preferencesStore";

export default function CrystalBall() {
  const state = useOracleStore((store) => store.state);
  const reduceMotion = usePreferencesStore((store) => store.reduceMotion);

  return (
    <Motion.div
      className={`crystal-ball crystal-${state}`}
      animate={
        reduceMotion
          ? { opacity: 0.9 }
          : {
              boxShadow: [
                "0 0 22px rgba(56, 189, 248, 0.45)",
                "0 0 46px rgba(236, 72, 153, 0.62)",
                "0 0 22px rgba(56, 189, 248, 0.45)",
              ],
              scale: [1, 1.04, 1],
            }
      }
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    >
      <span />
    </Motion.div>
  );
}
