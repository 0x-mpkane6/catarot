import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";

import { subscribeScene } from "./sceneTransition";
import useIsMobile from "../../hooks/useIsMobile";
import useReducedMotion from "../../hooks/useReducedMotion";
import "./CosmicVeil.css";

// Mốc thời gian: che kín ~300ms thì đổi nội dung, ~640ms thì tan hẳn.
const COVER_AT_MS = 300;
const DONE_AT_MS = 640;

/**
 * "Tấm phủ vũ trụ" — host hiệu ứng chuyển cảnh trong trang (playScene).
 *
 * CHỈ đăng ký làm host trên MOBILE (và khi không bật Giảm chuyển động). Trên
 * desktop không subscribe → playScene tự gọi onCover ngay → giữ NGUYÊN hành vi
 * chuyển cảnh tức thì như cũ (không đụng desktop).
 *
 * Dùng setTimeout xác định mốc (KHÔNG dựa vào onAnimationComplete của framer —
 * trong vài trường hợp callback đó không kích hoạt khiến tấm phủ kẹt, chặn luôn
 * điều hướng). Cách này đảm bảo onCover LUÔN chạy và tấm phủ LUÔN tan.
 */
export default function CosmicVeil() {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    if (!isMobile || reduced) return undefined;

    const clearTimers = () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };

    const unsubscribe = subscribeScene(({ onCover } = {}) => {
      clearTimers();
      setActive(true);
      timersRef.current.push(
        window.setTimeout(() => {
          if (typeof onCover === "function") onCover();
        }, COVER_AT_MS)
      );
      timersRef.current.push(
        window.setTimeout(() => setActive(false), DONE_AT_MS)
      );
    });

    return () => {
      clearTimers();
      unsubscribe();
    };
  }, [isMobile, reduced]);

  return (
    <AnimatePresence>
      {active && (
        <Motion.div
          key="cosmic-veil"
          className="cosmic-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Motion.span
            className="cosmic-veil__glow"
            initial={{ scale: 0.6, opacity: 0.4 }}
            animate={{ scale: 1.15, opacity: 0.9, rotate: 90 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <Motion.span
            className="cosmic-veil__rune"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            ✦
          </Motion.span>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
