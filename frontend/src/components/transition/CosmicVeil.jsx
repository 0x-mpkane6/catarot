// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { subscribeScene } from "./sceneTransition";

/**
 * "Cosmic Vortex" — chuyển cảnh dạng XOÁY.
 *
 * Một xoáy thiên hà (các cánh xoắn quay ngược chiều + cuộn vào tâm) bung ra che kín
 * màn hình, giữ một nhịp, rồi cuộn co về một điểm để lộ cảnh mới. Phát cho CẢ:
 *   - đổi route (theo useLocation), VÀ
 *   - chuyển cảnh trong trang (bấm danh mục / chọn lá bài) qua playScene({onCover}).
 *
 * onCover() được gọi đúng lúc xoáy che kín → đổi nội dung khi đang bị che, người dùng
 * chỉ thấy cảnh mới khi xoáy tan. GPU-only (transform/opacity/clip-path/filter),
 * overlay pointer-events:none nên không đụng position:fixed của trang.
 *
 * prefers-reduced-motion: KHÔNG vẽ xoáy, nhưng vẫn gọi onCover ngay để cảnh vẫn đổi.
 */
export default function CosmicVeil() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const reduceRef = useRef(reduce);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);

  const isFirst = useRef(true);
  const seq = useRef(0);
  const [active, setActive] = useState(null); // { token, onCover }

  const DUR = 1.4;
  const COVER_PEAK_MS = 520; // thời điểm xoáy che kín → swap nội dung

  const trigger = (onCover) => {
    if (reduceRef.current) {
      if (typeof onCover === "function") onCover();
      return;
    }
    seq.current += 1;
    setActive({ token: `t${seq.current}`, onCover: typeof onCover === "function" ? onCover : null });
  };

  // Đổi route
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    trigger(null);
  }, [location.pathname]);

  // Chuyển cảnh trong trang (imperative)
  useEffect(() => subscribeScene((opts) => trigger(opts?.onCover)), []);

  // Swap nội dung đúng lúc xoáy che kín
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => {
      if (active.onCover) active.onCover();
    }, COVER_PEAK_MS);
    return () => clearTimeout(t);
  }, [active]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.token}
          aria-hidden="true"
          className="vx"
          initial={{ clipPath: "circle(0% at 50% 50%)" }}
          animate={{
            clipPath: [
              "circle(0% at 50% 50%)",
              "circle(160% at 50% 50%)",
              "circle(160% at 50% 50%)",
              "circle(0% at 50% 50%)",
            ],
          }}
          transition={{ duration: DUR, times: [0, 0.3, 0.62, 1], ease: [0.65, 0, 0.35, 1] }}
          onAnimationComplete={() => setActive(null)}
        >
          {/* Cánh xoắn lớn — quay thuận, cuộn vào tâm */}
          <motion.div
            className="vx-spiral vx-spiral-a"
            initial={{ rotate: 0, scale: 0.35, opacity: 0 }}
            animate={{ rotate: 430, scale: [0.35, 1.5, 0.3], opacity: [0, 1, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: "easeInOut" }}
          />
          {/* Cánh xoắn nhỏ — quay ngược, tạo churn */}
          <motion.div
            className="vx-spiral vx-spiral-b"
            initial={{ rotate: 0, scale: 0.3, opacity: 0 }}
            animate={{ rotate: -620, scale: [0.3, 1.15, 0.2], opacity: [0, 1, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: "easeInOut" }}
          />
          {/* Lõi sáng */}
          <motion.div
            className="vx-core"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 0.2], opacity: [0, 1, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: "easeInOut" }}
          />
          {/* Lóa sáng đỉnh điểm */}
          <motion.div
            className="vx-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.8, 0] }}
            transition={{ duration: DUR, times: [0, 0.36, 0.46, 0.64], ease: "easeOut" }}
          />

          <style>{`
            .vx {
              position: fixed;
              inset: 0;
              z-index: 120;
              pointer-events: none;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              background: radial-gradient(circle at 50% 50%,
                rgba(124, 58, 237, 0.96),
                rgba(43, 15, 79, 0.97) 46%,
                #05030f 80%);
              will-change: clip-path;
            }
            .vx-spiral {
              position: absolute;
              left: 50%;
              top: 50%;
              width: 200vmax;
              height: 200vmax;
              margin: -100vmax 0 0 -100vmax;
              border-radius: 50%;
              filter: blur(3px);
              will-change: transform, opacity;
              -webkit-mask: radial-gradient(circle, transparent 4%, #000 14%, #000 60%, transparent 80%);
              mask: radial-gradient(circle, transparent 4%, #000 14%, #000 60%, transparent 80%);
            }
            .vx-spiral-a {
              background: conic-gradient(from 0deg at 50% 50%,
                rgba(236,201,255,0) 0deg,
                rgba(236,201,255,0.55) 22deg,
                rgba(168,85,247,0) 70deg,
                rgba(236,201,255,0) 130deg,
                rgba(217,70,239,0.5) 168deg,
                rgba(168,85,247,0) 220deg,
                rgba(236,201,255,0) 280deg,
                rgba(165,180,252,0.5) 318deg,
                rgba(168,85,247,0) 356deg);
            }
            .vx-spiral-b {
              width: 130vmax;
              height: 130vmax;
              margin: -65vmax 0 0 -65vmax;
              filter: blur(2px);
              background: conic-gradient(from 40deg at 50% 50%,
                rgba(255,255,255,0) 0deg,
                rgba(255,255,255,0.5) 30deg,
                rgba(217,70,239,0) 90deg,
                rgba(255,255,255,0) 170deg,
                rgba(165,180,252,0.55) 210deg,
                rgba(99,102,241,0) 280deg,
                rgba(255,255,255,0) 360deg);
            }
            .vx-core {
              position: absolute;
              width: 90px;
              height: 90px;
              border-radius: 50%;
              background: radial-gradient(circle, #fff, rgba(236,201,255,0.95) 36%, rgba(168,85,247,0) 72%);
              box-shadow: 0 0 60px 16px rgba(236, 201, 255, 0.7);
              will-change: transform, opacity;
            }
            .vx-flash {
              position: absolute;
              inset: 0;
              background: radial-gradient(circle at 50% 50%,
                rgba(255,255,255,0.92),
                rgba(236,201,255,0.55) 36%,
                rgba(168,85,247,0) 70%);
              will-change: opacity;
            }
            @media (prefers-reduced-motion: reduce) {
              .vx { display: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
