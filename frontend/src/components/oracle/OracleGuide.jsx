import { useEffect, useMemo, useState } from "react";
import { motion as Motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import oracleImage from "../../assets/oracle/oracle-guide.png";
import { useOracleStore } from "../../stores/oracleStore";
import { usePreferencesStore } from "../../stores/preferencesStore";
import CrystalBall from "./CrystalBall";
import FloatingTarotCards from "./FloatingTarotCards";
import OracleAura from "./OracleAura";
import OracleDialogue from "./OracleDialogue";

export default function OracleGuide() {
  const oracleState = useOracleStore((state) => state.state);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);

  // mouse tracking toàn cục — eyeglow + pupil di chuyển theo cursor toàn trang
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const eyeShiftX = useSpring(useTransform(mouseX, [-1, 1], [-6, 6]), { stiffness: 90, damping: 16 });
  const eyeShiftY = useSpring(useTransform(mouseY, [-1, 1], [-3, 3]), { stiffness: 90, damping: 16 });
  const headTiltY = useSpring(useTransform(mouseX, [-1, 1], [-3.5, 3.5]), { stiffness: 50, damping: 16 });
  const headTiltX = useSpring(useTransform(mouseY, [-1, 1], [2, -2]), { stiffness: 50, damping: 16 });
  const headShiftX = useSpring(useTransform(mouseX, [-1, 1], [-6, 6]), { stiffness: 50, damping: 18 });
  const headShiftY = useSpring(useTransform(mouseY, [-1, 1], [-4, 4]), { stiffness: 50, damping: 18 });

  useEffect(() => {
    if (reduceMotion) return undefined;
    const handler = (event) => {
      mouseX.set((event.clientX / window.innerWidth) * 2 - 1);
      mouseY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [reduceMotion, mouseX, mouseY]);

  // chớp mắt ngẫu nhiên
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (reduceMotion) return undefined;
    let t;
    const loop = () => {
      const wait = 2400 + Math.random() * 4200;
      t = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => {
          setBlinking(false);
          if (Math.random() < 0.18) {
            setTimeout(() => {
              setBlinking(true);
              setTimeout(() => setBlinking(false), 130);
            }, 220);
          }
          loop();
        }, 140);
      }, wait);
    };
    loop();
    return () => clearTimeout(t);
  }, [reduceMotion]);

  const stars = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        id: index,
        left: `${(index * 31 + 5) % 90}%`,
        top: `${(index * 23 + 7) % 80}%`,
        delay: `${(index % 5) * 0.5}s`,
        duration: `${2.2 + (index % 4) * 0.6}s`,
      })),
    [],
  );

  const handCastParticles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        id: index,
        left: `${48 + (index * 7) % 40}%`,
        delay: `${(index % 7) * 0.45}s`,
        duration: `${3.6 + (index % 5) * 0.5}s`,
        size: `${3 + (index % 3)}px`,
        hue: index % 3,
      })),
    [],
  );

  const isSpeaking = oracleState === "speaking" || oracleState === "revealing" || oracleState === "welcome";
  const isThinking = oracleState === "thinking" || oracleState === "drawing";
  const isListening = oracleState === "listening";

  const leanIn = isListening
    ? { scale: 1.04, x: -6, rotateZ: -3 }
    : isThinking
      ? { scale: 1.02, x: 0, rotateZ: 0 }
      : { scale: 1, x: 0, rotateZ: 0 };

  return (
    <section className={`oracle-guide state-${oracleState}`}>
      <OracleAura />

      {!reduceMotion && isListening && (
        <div className="oracle-listening-rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      {!reduceMotion && isListening && <span className="oracle-ear-glow" aria-hidden="true" />}

      <Motion.div
        className="oracle-portrait-wrap oracle-alive"
        style={
          reduceMotion
            ? undefined
            : { rotateX: headTiltX, rotateY: headTiltY, x: headShiftX, y: headShiftY }
        }
        animate={reduceMotion ? undefined : leanIn}
        transition={{ type: "spring", stiffness: 70, damping: 14 }}
      >
        <Motion.div
          className="oracle-breath"
          animate={
            reduceMotion
              ? { scale: 1 }
              : {
                  scaleY: [1, 1.012, 1.018, 1.012, 1],
                  scaleX: [1, 1.006, 1.0, 0.998, 1],
                  y: [0, -2, 0, 1, 0],
                }
          }
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Motion.div
            className="oracle-sway"
            animate={
              reduceMotion
                ? { rotate: 0 }
                : { rotate: isListening ? [-1.4, 1.4, -1.4] : [-0.6, 0.6, -0.6] }
            }
            transition={{
              duration: isListening ? 3.2 : 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="oracle-portrait-stage">
              <img className="oracle-portrait" src={oracleImage} alt="Nu tien tri Oracle Chamber" />

              {/* Mat nhin theo chuot */}
              <Motion.span
                className={`oracle-eye-glow ${blinking ? "is-blinking" : ""}`}
                style={reduceMotion ? undefined : { x: eyeShiftX, y: eyeShiftY }}
              />
              <Motion.span
                className={`oracle-eye-glow oracle-eye-glow-r ${blinking ? "is-blinking" : ""}`}
                style={reduceMotion ? undefined : { x: eyeShiftX, y: eyeShiftY }}
              />

              {/* Pupil */}
              <Motion.span
                className="oracle-pupil"
                style={reduceMotion ? undefined : { x: eyeShiftX, y: eyeShiftY }}
              />
              <Motion.span
                className="oracle-pupil oracle-pupil-r"
                style={reduceMotion ? undefined : { x: eyeShiftX, y: eyeShiftY }}
              />

              <span className={`oracle-eyelid ${blinking ? "is-down" : ""}`} />
              <span className={`oracle-mouth-glow ${isSpeaking ? "is-speaking" : ""}`} />
              <span className="oracle-candlelight" />

              <Motion.span
                className="oracle-breath-mist"
                animate={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: [0, 0.45, 0],
                        y: [0, -22, -34],
                        scale: [0.6, 1.1, 1.4],
                      }
                }
                transition={{ duration: 4.6, repeat: Infinity, ease: "easeOut" }}
              />

              <span className="oracle-veil" />
              <span className="oracle-hairwind" />

              <CrystalBall />
              <FloatingTarotCards />
            </div>
          </Motion.div>
        </Motion.div>

        {/* Particle phep tu tay khi thinking/speaking */}
        {!reduceMotion && (isThinking || isSpeaking) && (
          <div className="oracle-handcast" aria-hidden="true">
            {handCastParticles.map((particle) => (
              <span
                key={particle.id}
                className={`handcast-particle hue-${particle.hue}`}
                style={{
                  left: particle.left,
                  width: particle.size,
                  height: particle.size,
                  animationDelay: particle.delay,
                  animationDuration: particle.duration,
                }}
              />
            ))}
          </div>
        )}
      </Motion.div>

      {!reduceMotion && (
        <div className="oracle-stars" aria-hidden="true">
          {stars.map((star) => (
            <span
              key={star.id}
              className="oracle-star"
              style={{
                left: star.left,
                top: star.top,
                animationDelay: star.delay,
                animationDuration: star.duration,
              }}
            />
          ))}
        </div>
      )}

      <OracleDialogue />
    </section>
  );
}
