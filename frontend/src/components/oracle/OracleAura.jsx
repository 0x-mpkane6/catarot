import { motion as Motion } from "framer-motion";
import { useOracleStore } from "../../stores/oracleStore";
import { usePreferencesStore } from "../../stores/preferencesStore";

export default function OracleAura() {
  const intensity = useOracleStore((state) => state.intensity);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);

  return (
    <Motion.div
      className={`oracle-aura aura-${intensity}`}
      animate={
        reduceMotion
          ? { opacity: 0.58 }
          : {
              opacity: [0.42, 0.92, 0.42],
              scale: [1, 1.06, 1],
            }
      }
      transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    />
  );
}
