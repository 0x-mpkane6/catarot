// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * "Arcane Veil" — khoảnh khắc chuyển cảnh giữa các route.
 *
 * Mỗi lần điều hướng, một tấm màn vũ trụ (gradient tím sâu + trường sao + ấn ký
 * xoay phát sáng) quét dọc màn hình, che đi lúc swap trang rồi vén lên để lộ trang
 * mới. Một khoảnh khắc được dàn dựng, thay cho cú "nhảy" cảnh khô khan.
 *
 * Tôn trọng prefers-reduced-motion: tắt hoàn toàn màn (trang vẫn fade nhẹ ở nơi khác).
 */
export default function CosmicVeil() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const isFirst = useRef(true);
  const seq = useRef(0);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Bỏ qua lần mount đầu để trang chủ tải nhanh, không bị chặn bởi màn.
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    seq.current += 1;
    setToken(`${location.pathname}#${seq.current}`);
  }, [location.pathname]);

  if (reduce) return null;

  const SWEEP = 0.95;

  return (
    <AnimatePresence>
      {token && (
        <motion.div
          key={token}
          aria-hidden="true"
          className="cosmic-veil"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{
            clipPath: [
              "inset(0 0 100% 0)", // ẩn (dải mỏng trên đỉnh)
              "inset(0 0 0% 0)",   // che kín màn hình
              "inset(100% 0 0% 0)", // vén xuống, lộ trang mới
            ],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: SWEEP, times: [0, 0.5, 1], ease: [0.83, 0, 0.17, 1] }}
          onAnimationComplete={() => setToken(null)}
        >
          <div className="cv-stars" />
          <div className="cv-aurora" />

          <motion.div
            className="cv-sigil"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.15, 0.2], opacity: [0, 1, 0] }}
            transition={{ duration: SWEEP, times: [0, 0.5, 1], ease: "easeInOut" }}
          >
            <span className="cv-ring cv-ring-a" />
            <span className="cv-ring cv-ring-b" />
            <span className="cv-core" />
            <span className="cv-glyph">✦</span>
          </motion.div>

          <style>{`
            .cosmic-veil {
              position: fixed;
              inset: 0;
              z-index: 120;
              pointer-events: none;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              background:
                radial-gradient(circle at 50% 42%, rgba(167,99,250,0.95), rgba(46,16,84,0.97) 48%, #060312 78%);
            }
            .cv-stars {
              position: absolute;
              inset: -10%;
              background-image:
                radial-gradient(1.5px 1.5px at 20% 30%, rgba(255,255,255,0.9), transparent),
                radial-gradient(1.5px 1.5px at 75% 25%, rgba(255,255,255,0.8), transparent),
                radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.85), transparent),
                radial-gradient(1.5px 1.5px at 85% 65%, rgba(236,201,255,0.9), transparent),
                radial-gradient(1px 1px at 60% 50%, rgba(255,255,255,0.8), transparent),
                radial-gradient(1px 1px at 12% 80%, rgba(255,255,255,0.7), transparent),
                radial-gradient(1.5px 1.5px at 90% 88%, rgba(255,255,255,0.85), transparent);
              animation: cv-twinkle 0.95s ease-in-out;
            }
            .cv-aurora {
              position: absolute;
              left: 50%;
              top: 50%;
              width: 140vmax;
              height: 140vmax;
              transform: translate(-50%, -50%);
              background:
                conic-gradient(from 180deg at 50% 50%,
                  rgba(217,70,239,0.0),
                  rgba(217,70,239,0.18) 20%,
                  rgba(99,102,241,0.0) 40%,
                  rgba(168,85,247,0.16) 65%,
                  rgba(217,70,239,0.0) 85%);
              filter: blur(40px);
              animation: cv-spin 1.6s linear;
              opacity: 0.7;
            }
            .cv-sigil {
              position: relative;
              width: 230px;
              height: 230px;
              display: flex;
              align-items: center;
              justify-content: center;
              filter: drop-shadow(0 0 26px rgba(217,70,239,0.65));
            }
            .cv-ring {
              position: absolute;
              inset: 0;
              border-radius: 50%;
              -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
              mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
            }
            .cv-ring-a {
              background: conic-gradient(from 0deg, transparent, rgba(236,201,255,0.95), transparent 35%, rgba(168,85,247,0.95), transparent 72%);
              animation: cv-spin 1.4s linear infinite;
            }
            .cv-ring-b {
              inset: 34px;
              background: conic-gradient(from 120deg, transparent, rgba(217,70,239,0.9), transparent 50%, rgba(99,102,241,0.85), transparent 90%);
              animation: cv-spin-rev 2s linear infinite;
            }
            .cv-core {
              width: 60px;
              height: 60px;
              border-radius: 50%;
              background: radial-gradient(circle, #fff, rgba(236,201,255,0.95) 40%, rgba(168,85,247,0.0) 72%);
              box-shadow: 0 0 40px 8px rgba(236,201,255,0.7);
            }
            .cv-glyph {
              position: absolute;
              font-size: 26px;
              color: #fff;
              text-shadow: 0 0 18px rgba(255,255,255,0.9);
            }
            @keyframes cv-spin { to { transform: rotate(360deg); } }
            @keyframes cv-spin-rev { to { transform: rotate(-360deg); } }
            @keyframes cv-twinkle {
              0%, 100% { opacity: 0.35; }
              50%      { opacity: 0.9; }
            }
            @media (prefers-reduced-motion: reduce) {
              .cosmic-veil { display: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
