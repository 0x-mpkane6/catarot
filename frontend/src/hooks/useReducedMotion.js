import { useEffect, useState } from "react";

// Tôn trọng tuỳ chọn "Giảm chuyển động" của hệ điều hành (Cài đặt > Trợ năng).
// MỌI hiệu ứng mới (particle, reveal khi cuộn, tilt khi chạm…) phải tắt hoặc
// đơn giản hoá khi hook này trả về true — vừa để trợ năng, vừa tiết kiệm pin
// trên máy yếu.
export default function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setReduced(e.matches);
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
