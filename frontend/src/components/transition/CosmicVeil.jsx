// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { subscribeScene } from "./sceneTransition";

/**
 * "Swipe Veil" — chuyển cảnh QUẸT NGANG đơn giản: một tấm màn tím trượt từ trái
 * vào che kín màn hình, giữ một nhịp rất ngắn để swap nội dung, rồi trượt tiếp
 * ra phải để lộ cảnh mới. KHÔNG khói, KHÔNG blur nặng, KHÔNG lóa chói — gọn,
 * nhanh (~0.6s), dễ chịu hơn hiệu ứng khói cũ.
 *
 * Phát cho CẢ đổi route VÀ bấm danh mục trong trang (qua playScene({onCover})).
 * onCover() chạy đúng lúc tấm màn che kín (x = 0). Chỉ animate transform (GPU);
 * overlay pointer-events:none. prefers-reduced-motion: không vẽ, chỉ swap ngay.
 *
 * Lưu ý: hiệu ứng KHÓI bám theo con trỏ chuột là component KHÁC (SplashCursor),
 * không liên quan tới tấm màn chuyển cảnh này.
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

  const DUR = 0.6; // tổng thời lượng quẹt (giây)
  const COVER_PEAK_MS = 240; // thời điểm tấm màn che kín (x=0) → swap nội dung

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

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.token}
          aria-hidden="true"
          className="swipe-veil"
          // Trượt vào che kín (x:0), giữ một nhịp ngắn để swap, rồi trượt ra phải.
          initial={{ x: "-100%" }}
          animate={{ x: ["-100%", "0%", "0%", "100%"] }}
          transition={{
            duration: DUR,
            times: [0, 0.4, 0.6, 1],
            ease: [0.7, 0, 0.3, 1],
          }}
          onAnimationComplete={() => setActive(null)}
        >
          <style>{`
            .swipe-veil {
              position: fixed;
              inset: 0;
              z-index: 120;
              pointer-events: none;
              will-change: transform;
              background: linear-gradient(
                135deg,
                rgba(46, 22, 84, 0.985),
                rgba(14, 8, 28, 0.995)
              );
            }
            /* Mép dẫn (cạnh phải) phát sáng nhẹ → cảm giác "lằn quẹt", không lóa. */
            .swipe-veil::after {
              content: "";
              position: absolute;
              top: 0;
              right: 0;
              bottom: 0;
              width: 3px;
              background: linear-gradient(
                180deg,
                rgba(217, 70, 239, 0),
                rgba(217, 70, 239, 0.55),
                rgba(168, 85, 247, 0)
              );
              box-shadow: 0 0 22px rgba(217, 70, 239, 0.45);
            }
            @media (prefers-reduced-motion: reduce) {
              .swipe-veil { display: none; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
