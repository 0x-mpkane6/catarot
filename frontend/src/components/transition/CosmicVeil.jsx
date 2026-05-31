// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { subscribeScene } from "./sceneTransition";

/**
 * "Smoke Swirl" — chuyển cảnh dạng KHÓI XOÁY (ảo).
 *
 * Lấy cảm hứng từ hiệu ứng con trỏ (SplashCursor): những cụm khói tím lỏng tỏa ra
 * từ tâm, cuộn xoáy DẦN RA theo 2 luồng quay ngược chiều, mờ ảo (blur + blend screen),
 * giữ một nhịp rồi tan để lộ cảnh mới. Phát cho CẢ đổi route VÀ bấm danh mục trong trang
 * (qua playScene({onCover})). onCover() chạy đúng lúc khói che kín → đổi nội dung khi
 * đang bị che. GPU-only; overlay pointer-events:none.
 *
 * prefers-reduced-motion: KHÔNG vẽ khói nhưng vẫn gọi onCover ngay để cảnh vẫn đổi.
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

  const DUR = 1.5;
  const COVER_PEAK_MS = 560; // thời điểm khói che kín → swap nội dung

  const trigger = (onCover) => {
    if (reduceRef.current) {
      if (typeof onCover === "function") onCover();
      return;
    }
    seq.current += 1;
    setActive({ token: `t${seq.current}`, onCover: typeof onCover === "function" ? onCover : null });
  };

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    trigger(null);
  }, [location.pathname]);

  useEffect(() => subscribeScene((opts) => trigger(opts?.onCover)), []);

  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => {
      if (active.onCover) active.onCover();
    }, COVER_PEAK_MS);
    return () => clearTimeout(t);
  }, [active]);

  if (reduce) return null;

  // Một luồng khói = nhiều cụm puff lệch tâm, quay + nở dần ra.
  const swarm = (dir) => ({
    initial: { rotate: 0, scale: 0.28, opacity: 0 },
    animate: { rotate: dir * 240, scale: [0.28, 1.15, 1.95], opacity: [0, 0.95, 0] },
    transition: { duration: DUR, times: [0, 0.5, 1], ease: [0.33, 0, 0.2, 1] },
  });

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.token}
          aria-hidden="true"
          className="smk"
          initial={{ clipPath: "circle(0% at 50% 50%)" }}
          animate={{
            clipPath: [
              "circle(0% at 50% 50%)",
              "circle(160% at 50% 50%)",
              "circle(160% at 50% 50%)",
              "circle(0% at 50% 50%)",
            ],
          }}
          transition={{ duration: DUR, times: [0, 0.32, 0.62, 1], ease: [0.6, 0, 0.4, 1] }}
          onAnimationComplete={() => setActive(null)}
        >
          <motion.div className="smk-swarm" {...swarm(1)}>
            <span className="smk-puff p1" />
            <span className="smk-puff p2" />
            <span className="smk-puff p3" />
          </motion.div>

          <motion.div className="smk-swarm" {...swarm(-1)}>
            <span className="smk-puff p4" />
            <span className="smk-puff p5" />
            <span className="smk-puff p6" />
          </motion.div>

          {/* Lõi sáng mềm như nguồn khói */}
          <motion.div
            className="smk-core"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.1, 2.2], opacity: [0, 0.95, 0] }}
            transition={{ duration: DUR, times: [0, 0.46, 1], ease: "easeOut" }}
          />
          {/* Lóa nhẹ (ảo, không chói) */}
          <motion.div
            className="smk-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.45, 0] }}
            transition={{ duration: DUR, times: [0, 0.38, 0.48, 0.66], ease: "easeOut" }}
          />

          <style>{`
            .smk {
              position: fixed;
              inset: 0;
              z-index: 120;
              pointer-events: none;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              background: radial-gradient(circle at 50% 50%,
                rgba(120, 60, 220, 0.78),
                rgba(40, 14, 78, 0.92) 50%,
                #07041a 82%);
              -webkit-backdrop-filter: blur(7px);
              backdrop-filter: blur(7px);
              will-change: clip-path;
            }
            .smk-swarm {
              position: absolute;
              left: 50%;
              top: 50%;
              width: 90vmax;
              height: 90vmax;
              margin: -45vmax 0 0 -45vmax;
              will-change: transform, opacity;
            }
            .smk-puff {
              position: absolute;
              border-radius: 50%;
              filter: blur(52px);
              mix-blend-mode: screen;
            }
            /* các cụm khói lệch tâm, kích thước/màu khác nhau → cuộn tự nhiên */
            .p1 { left: 26%; top: 22%; width: 40vmax; height: 40vmax;
              background: radial-gradient(circle, rgba(168,85,247,0.85), rgba(168,85,247,0) 62%); }
            .p2 { left: 58%; top: 40%; width: 32vmax; height: 32vmax;
              background: radial-gradient(circle, rgba(217,70,239,0.7), rgba(217,70,239,0) 62%); }
            .p3 { left: 40%; top: 64%; width: 36vmax; height: 36vmax;
              background: radial-gradient(circle, rgba(236,201,255,0.62), rgba(236,201,255,0) 62%); }
            .p4 { left: 60%; top: 60%; width: 38vmax; height: 38vmax;
              background: radial-gradient(circle, rgba(124,58,237,0.8), rgba(124,58,237,0) 62%); }
            .p5 { left: 30%; top: 50%; width: 30vmax; height: 30vmax;
              background: radial-gradient(circle, rgba(99,102,241,0.62), rgba(99,102,241,0) 62%); }
            .p6 { left: 50%; top: 30%; width: 34vmax; height: 34vmax;
              background: radial-gradient(circle, rgba(192,132,252,0.7), rgba(192,132,252,0) 62%); }
            .smk-core {
              position: absolute;
              width: 120px;
              height: 120px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(255,255,255,0.95), rgba(236,201,255,0.7) 34%, rgba(168,85,247,0) 72%);
              filter: blur(6px);
              mix-blend-mode: screen;
              will-change: transform, opacity;
            }
            .smk-flash {
              position: absolute;
              inset: 0;
              background: radial-gradient(circle at 50% 50%,
                rgba(236,201,255,0.7),
                rgba(168,85,247,0.25) 40%,
                rgba(124,58,237,0) 72%);
              will-change: opacity;
            }
            @media (prefers-reduced-motion: reduce) {
              .smk { display: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
