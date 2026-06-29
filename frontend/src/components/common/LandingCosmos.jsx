import { useEffect } from "react";
import {
  motion as Motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

import useReducedMotion from "../../hooks/useReducedMotion";
import "./LandingCosmos.css";

// Tinh tú rải sẵn (tạo 1 lần lúc import) — vị trí/độ to/nhịp lấp lánh ngẫu nhiên
// nhưng cố định suốt phiên để không nhảy mỗi lần render.
const STARS = Array.from({ length: 64 }, (_, i) => ({
  id: i,
  top: Math.random() * 100,
  left: Math.random() * 100,
  size: Math.random() * 1.8 + 1,
  delay: Math.random() * 4,
  dur: 2.6 + Math.random() * 3.4,
}));

/**
 * Nền vũ trụ sống động cho landing — CHỈ desktop. Ba quầng nebula trôi + lớp
 * tinh tú lấp lánh, cả hai trượt nhẹ theo con trỏ (parallax) để có chiều sâu 3D.
 * Tôn trọng Giảm chuyển động: đứng yên, không bám chuột.
 */
export default function LandingCosmos() {
  const reduced = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 20, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 40, damping: 20, mass: 0.6 });

  const nebulaX = useTransform(sx, [-0.5, 0.5], [-28, 28]);
  const nebulaY = useTransform(sy, [-0.5, 0.5], [-20, 20]);
  const starX = useTransform(sx, [-0.5, 0.5], [-11, 11]);
  const starY = useTransform(sy, [-0.5, 0.5], [-8, 8]);

  useEffect(() => {
    if (reduced) return undefined;
    const onMove = (e) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, mx, my]);

  return (
    <div className="landing-cosmos" aria-hidden="true">
      <Motion.div
        className="landing-cosmos__nebula"
        style={reduced ? undefined : { x: nebulaX, y: nebulaY }}
      >
        <span className="landing-cosmos__blob landing-cosmos__blob--violet" />
        <span className="landing-cosmos__blob landing-cosmos__blob--magenta" />
        <span className="landing-cosmos__blob landing-cosmos__blob--cyan" />
      </Motion.div>

      <Motion.div
        className="landing-cosmos__stars"
        style={reduced ? undefined : { x: starX, y: starY }}
      >
        {STARS.map((s) => (
          <span
            key={s.id}
            className="landing-cosmos__star"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </Motion.div>
    </div>
  );
}
