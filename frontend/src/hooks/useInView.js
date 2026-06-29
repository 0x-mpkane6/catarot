import { useEffect, useRef, useState } from "react";

/**
 * Báo khi phần tử lọt vào khung nhìn — dùng cho hiệu ứng "hiện dần khi cuộn tới"
 * (staggered reveal) trên mobile. Mặc định chỉ kích hoạt MỘT lần (triggerOnce)
 * để nội dung không nhấp nháy khi cuộn qua lại.
 *
 * Trả về [ref, inView]: gắn ref vào phần tử cần theo dõi.
 *
 * @param {{ rootMargin?: string, threshold?: number, triggerOnce?: boolean }} [opts]
 * @returns {[import("react").RefObject<HTMLElement>, boolean]}
 */
export default function useInView({
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.15,
  triggerOnce = true,
} = {}) {
  const ref = useRef(null);
  // Khởi tạo theo khả năng hỗ trợ IO: không hỗ trợ → hiện luôn (không khoá nội dung).
  // Đặt ngay trong initializer để KHÔNG gọi setState đồng bộ trong effect.
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) observer.disconnect();
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, triggerOnce]);

  return [ref, inView];
}
