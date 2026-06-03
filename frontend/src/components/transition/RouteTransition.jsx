// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";

import CosmicVeil from "./CosmicVeil";

/**
 * Bọc nội dung route: phát tấm màn "quẹt ngang" (CosmicVeil) mỗi lần đổi route,
 * đồng thời cho trang mới hiện lên bằng fade opacity, canh để nội dung đã sẵn sàng
 * đúng lúc tấm màn bắt đầu trượt đi lộ cảnh.
 *
 * key theo pathname → trang remount mỗi lần điều hướng nên fade vào luôn chạy lại.
 * Tấm màn (CosmicVeil) che khoảnh khắc swap/lazy-load nên không thấy cú "nhảy" cảnh.
 */
export default function RouteTransition({ children }) {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <>
      <CosmicVeil />
      {/* Chỉ animate OPACITY ở cấp trang: transform/filter còn sót lại sẽ tạo containing-block
          làm hỏng các panel position:fixed + cuộn trang của HomePage. Phần chuyển cảnh do tấm màn
          (CosmicVeil) đảm nhận; thẻ bên trong các trang auth vẫn giữ animation zoom/blur riêng. */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: reduce ? 0.15 : 0.3,
          // Để trang fade xong trước khi tấm màn trượt đi (~0.35s) → quẹt ra là thấy cảnh mới.
          delay: reduce ? 0 : 0.08,
          ease: "easeOut",
        }}
        style={{ width: "100%", minHeight: "100vh" }}
      >
        {children}
      </motion.div>
    </>
  );
}
