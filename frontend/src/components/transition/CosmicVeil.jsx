// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * "Cosmic Warp Portal" — chuyển cảnh CHÁY HẾT MÌNH giữa các route.
 *
 * Mỗi lần điều hướng, một CỔNG VŨ TRỤ bùng nổ: cổng tròn iris mở ra che màn hình,
 * trường sao lao vun vút như nhảy hyperspace, ấn ký kép xoay tít + vầng cực quang
 * cuộn xoáy, một cú LÓA SÁNG ở đỉnh điểm, rồi cổng co rút về một điểm để "phun" ra
 * trang mới. Tất cả nằm trên overlay riêng (pointer-events:none) nên không đụng tới
 * bố cục position:fixed của trang; chỉ animate transform/opacity/clip-path/filter (GPU).
 *
 * Tôn trọng prefers-reduced-motion: tắt hẳn cổng (trang vẫn fade nhẹ ở nơi khác).
 */
export default function CosmicVeil() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const isFirst = useRef(true);
  const seq = useRef(0);
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    seq.current += 1;
    setToken(`${location.pathname}#${seq.current}`);
  }, [location.pathname]);

  if (reduce) return null;

  const DUR = 1.05;

  return (
    <AnimatePresence>
      {token && (
        <motion.div
          key={token}
          aria-hidden="true"
          className="warp"
          // Cổng iris: nở ra che kín (cover) → giữ → co về 1 điểm (lộ trang mới).
          initial={{ clipPath: "circle(0% at 50% 50%)" }}
          animate={{
            clipPath: [
              "circle(0% at 50% 50%)",
              "circle(150% at 50% 50%)",
              "circle(150% at 50% 50%)",
              "circle(0% at 50% 50%)",
            ],
          }}
          transition={{ duration: DUR, times: [0, 0.34, 0.6, 1], ease: [0.7, 0, 0.3, 1] }}
          onAnimationComplete={() => setToken(null)}
        >
          {/* Cực quang cuộn xoáy nền */}
          <motion.div
            className="warp-aurora"
            initial={{ rotate: 0, opacity: 0 }}
            animate={{ rotate: 140, opacity: [0, 0.8, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: "easeInOut" }}
          />

          {/* Trường sao lao vun vút (hyperspace) */}
          <motion.div
            className="warp-streaks"
            initial={{ scale: 0.25, rotate: 0, opacity: 0 }}
            animate={{ scale: [0.25, 1.5, 2.8], rotate: [0, 26, 64], opacity: [0, 1, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: "easeIn" }}
          />

          {/* Hai vòng cổng bùng ra */}
          <motion.div
            className="warp-ring"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 3.4], opacity: [0, 1, 0] }}
            transition={{ duration: DUR, times: [0, 0.42, 1], ease: [0.2, 0.8, 0.2, 1] }}
          />
          <motion.div
            className="warp-ring warp-ring-2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 0.9, 2.4], opacity: [0, 1, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: [0.2, 0.8, 0.2, 1] }}
          />

          {/* Ấn ký kép xoay tít + glyph */}
          <motion.div
            className="warp-sigil"
            initial={{ scale: 0.15, rotate: -140, opacity: 0 }}
            animate={{ scale: [0.15, 1.15, 0.35], rotate: [-140, 50, 150], opacity: [0, 1, 0] }}
            transition={{ duration: DUR, times: [0, 0.5, 1], ease: "easeInOut" }}
          >
            <span className="warp-r warp-r-a" />
            <span className="warp-r warp-r-b" />
            <span className="warp-core" />
            <span className="warp-glyph">✦</span>
          </motion.div>

          {/* Lóa sáng đỉnh điểm */}
          <motion.div
            className="warp-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.92, 0] }}
            transition={{ duration: DUR, times: [0, 0.38, 0.5, 0.66], ease: "easeOut" }}
          />

          <style>{`
            .warp {
              position: fixed;
              inset: 0;
              z-index: 120;
              pointer-events: none;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              background:
                radial-gradient(circle at 50% 50%,
                  rgba(124, 58, 237, 0.95),
                  rgba(46, 16, 84, 0.97) 46%,
                  #05030f 78%);
              will-change: clip-path;
            }
            .warp-aurora {
              position: absolute;
              left: 50%;
              top: 50%;
              width: 180vmax;
              height: 180vmax;
              transform: translate(-50%, -50%);
              background: conic-gradient(from 0deg at 50% 50%,
                rgba(217,70,239,0) 0deg,
                rgba(217,70,239,0.30) 60deg,
                rgba(99,102,241,0) 140deg,
                rgba(168,85,247,0.28) 230deg,
                rgba(236,201,255,0) 320deg,
                rgba(217,70,239,0) 360deg);
              filter: blur(46px);
              will-change: transform, opacity;
            }
            .warp-streaks {
              position: absolute;
              left: 50%;
              top: 50%;
              width: 220vmax;
              height: 220vmax;
              transform: translate(-50%, -50%);
              background: repeating-conic-gradient(from 0deg at 50% 50%,
                rgba(255,255,255,0) 0deg,
                rgba(236,201,255,0.55) 0.45deg,
                rgba(255,255,255,0) 1.3deg 3deg);
              -webkit-mask: radial-gradient(circle, transparent 7%, #000 17%, #000 52%, transparent 72%);
              mask: radial-gradient(circle, transparent 7%, #000 17%, #000 52%, transparent 72%);
              will-change: transform, opacity;
            }
            .warp-ring {
              position: absolute;
              width: 42vmax;
              height: 42vmax;
              border-radius: 50%;
              border: 2px solid rgba(236, 201, 255, 0.9);
              box-shadow:
                0 0 60px rgba(217, 70, 239, 0.85),
                inset 0 0 50px rgba(217, 70, 239, 0.55);
              will-change: transform, opacity;
            }
            .warp-ring-2 {
              width: 30vmax;
              height: 30vmax;
              border-color: rgba(165, 180, 252, 0.85);
              box-shadow:
                0 0 50px rgba(129, 140, 248, 0.8),
                inset 0 0 40px rgba(129, 140, 248, 0.5);
            }
            .warp-sigil {
              position: relative;
              width: 260px;
              height: 260px;
              display: flex;
              align-items: center;
              justify-content: center;
              filter: drop-shadow(0 0 30px rgba(217, 70, 239, 0.7));
              will-change: transform, opacity;
            }
            .warp-r {
              position: absolute;
              inset: 0;
              border-radius: 50%;
              -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
              mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
            }
            .warp-r-a {
              background: conic-gradient(from 0deg, transparent, rgba(236,201,255,0.95), transparent 34%, rgba(168,85,247,0.95), transparent 70%);
              animation: warp-spin 1.1s linear infinite;
            }
            .warp-r-b {
              inset: 40px;
              background: conic-gradient(from 120deg, transparent, rgba(217,70,239,0.95), transparent 50%, rgba(99,102,241,0.9), transparent 90%);
              animation: warp-spin-rev 1.5s linear infinite;
            }
            .warp-core {
              width: 70px;
              height: 70px;
              border-radius: 50%;
              background: radial-gradient(circle, #fff, rgba(236,201,255,0.95) 38%, rgba(168,85,247,0) 72%);
              box-shadow: 0 0 50px 12px rgba(236, 201, 255, 0.75);
            }
            .warp-glyph {
              position: absolute;
              font-size: 30px;
              color: #fff;
              text-shadow: 0 0 22px rgba(255, 255, 255, 0.95);
            }
            .warp-flash {
              position: absolute;
              inset: 0;
              background: radial-gradient(circle at 50% 50%,
                rgba(255,255,255,0.95),
                rgba(236,201,255,0.6) 35%,
                rgba(168,85,247,0) 70%);
              will-change: opacity;
            }
            @keyframes warp-spin { to { transform: rotate(360deg); } }
            @keyframes warp-spin-rev { to { transform: rotate(-360deg); } }
            @media (prefers-reduced-motion: reduce) {
              .warp { display: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
