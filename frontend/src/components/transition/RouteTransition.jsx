// eslint-disable-next-line no-unused-vars -- motion.* dùng dưới dạng JSX element
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";

import CosmicVeil from "./CosmicVeil";

/**
 * Bọc nội dung route: phát "Arcane Veil" mỗi lần đổi route, đồng thời cho trang mới
 * hiện lên bằng hiệu ứng zoom-out + tan blur, canh đúng lúc tấm màn vén lên.
 *
 * key theo pathname → trang remount mỗi lần điều hướng nên hiệu ứng vào luôn chạy lại.
 * Tấm màn (CosmicVeil) che khoảnh khắc swap/lazy-load nên không thấy cú "nhảy" cảnh.
 */
export default function RouteTransition({ children }) {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <>
      <CosmicVeil />
      {/* Chỉ animate OPACITY ở cấp trang: transform/filter còn sót lại sẽ tạo containing-block
          làm hỏng các panel position:fixed + cuộn trang của HomePage. Hiệu ứng "wow" do tấm màn
          (CosmicVeil) đảm nhận; thẻ bên trong các trang auth vẫn giữ animation zoom/blur riêng. */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: reduce ? 0.2 : 0.55,
          // Hé lộ trang khi tấm màn đang vén lên (canh với nửa sau của sweep 0.95s).
          delay: reduce ? 0 : 0.22,
          ease: "easeOut",
        }}
        style={{ width: "100%", minHeight: "100vh" }}
      >
        {children}
      </motion.div>
    </>
  );
}
