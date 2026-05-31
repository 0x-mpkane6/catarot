// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { subscribeScene } from "./sceneTransition";

/**
 * "Dream Mist" — chuyển cảnh KHÓI TÍM MỀM ẢO, lấy đúng chất fluid của con trỏ
 * (SplashCursor): không có cạnh sắc, không clip-path, không lóa chói.
 *
 * Cơ chế: tấm màn FADE mờ mượt (opacity), nền frosted-blur dày làm trang phía sau
 * nhoè mộng mị; bên trên là những cụm khói tím blur rất to (mix-blend: screen) tan
 * toả nhẹ theo 2 luồng quay ngược chiều + một lõi lavender dịu. Giữ một nhịp giữa
 * lúc mờ kín để swap nội dung, rồi tan ra lộ cảnh mới.
 *
 * Phát cho CẢ đổi route VÀ bấm danh mục trong trang (qua playScene({onCover})).
 * onCover() chạy đúng lúc màn mờ kín. GPU-only (transform/opacity/filter); overlay
 * pointer-events:none. prefers-reduced-motion: không vẽ, chỉ swap ngay.
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

  const DUR = 1.6;
  const COVER_PEAK_MS = 600; // thời điểm màn mờ kín → swap nội dung

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

  // Một luồng khói = nhiều cụm puff lệch tâm, trôi + nở RẤT NHẸ (không xoáy gắt).
  const swarm = (dir) => ({
    initial: { rotate: dir * -24, scale: 0.55, opacity: 0 },
    animate: { rotate: dir * 96, scale: [0.55, 1.2, 1.65], opacity: [0, 0.8, 0] },
    transition: { duration: DUR, times: [0, 0.5, 1], ease: "easeInOut" },
  });

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.token}
          aria-hidden="true"
          className="smk"
          // Mềm/ảo: chỉ FADE opacity (không clip-path cạnh sắc), nền frosted nhoè dần.
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: DUR, times: [0, 0.24, 0.6, 1], ease: "easeInOut" }}
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

          {/* Lõi sáng MỀM (lavender dịu, không trắng chói) như nguồn khói tan ra */}
          <motion.div
            className="smk-core"
            initial={{ scale: 0.25, opacity: 0 }}
            animate={{ scale: [0.25, 1.4, 2.6], opacity: [0, 0.5, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: "easeInOut" }}
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
                rgba(124, 58, 237, 0.55),
                rgba(46, 16, 84, 0.68) 54%,
                rgba(8, 5, 26, 0.82) 90%);
              -webkit-backdrop-filter: blur(26px) saturate(1.15);
              backdrop-filter: blur(26px) saturate(1.15);
              will-change: opacity;
            }
            .smk-swarm {
              position: absolute;
              left: 50%;
              top: 50%;
              width: 98vmax;
              height: 98vmax;
              margin: -49vmax 0 0 -49vmax;
              will-change: transform, opacity;
            }
            .smk-puff {
              position: absolute;
              border-radius: 50%;
              filter: blur(88px);
              mix-blend-mode: screen;
              opacity: 0.9;
            }
            /* cụm khói lệch tâm, blur to + falloff mềm → tan loãng như fluid */
            .p1 { left: 24%; top: 22%; width: 48vmax; height: 48vmax;
              background: radial-gradient(circle, rgba(168,85,247,0.58), rgba(168,85,247,0) 70%); }
            .p2 { left: 58%; top: 38%; width: 42vmax; height: 42vmax;
              background: radial-gradient(circle, rgba(217,70,239,0.48), rgba(217,70,239,0) 70%); }
            .p3 { left: 40%; top: 66%; width: 46vmax; height: 46vmax;
              background: radial-gradient(circle, rgba(236,201,255,0.42), rgba(236,201,255,0) 70%); }
            .p4 { left: 62%; top: 60%; width: 46vmax; height: 46vmax;
              background: radial-gradient(circle, rgba(124,58,237,0.54), rgba(124,58,237,0) 70%); }
            .p5 { left: 28%; top: 52%; width: 40vmax; height: 40vmax;
              background: radial-gradient(circle, rgba(129,140,248,0.42), rgba(129,140,248,0) 70%); }
            .p6 { left: 50%; top: 30%; width: 44vmax; height: 44vmax;
              background: radial-gradient(circle, rgba(192,132,252,0.48), rgba(192,132,252,0) 70%); }
            .smk-core {
              position: absolute;
              width: 150px;
              height: 150px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(236,201,255,0.6), rgba(192,132,252,0.32) 42%, rgba(168,85,247,0) 76%);
              filter: blur(30px);
              mix-blend-mode: screen;
              will-change: transform, opacity;
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
