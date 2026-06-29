// Bộ "variants" framer-motion dùng chung cho hiệu ứng hiện dần trên mobile —
// gom về một chỗ để mọi màn có cùng nhịp & đường cong (ease "out-expo").
// Chỉ dùng transform/opacity (chạy trên compositor) để mượt 60fps trên điện thoại.

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];

// Hiện dần + trượt lên. Truyền custom = index để tạo độ trễ so le (stagger thủ công).
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: EASE_OUT_EXPO },
  }),
};

// Container điều phối stagger cho danh sách con dùng variant "fadeUp"/"popIn".
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// Phóng nhẹ vào — hợp cho thẻ bài / panel nổi bật.
export const popIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
  },
};

// Phiên bản "đứng yên" khi người dùng bật Giảm chuyển động: chỉ hiện, không dịch.
export const noMotion = {
  hidden: { opacity: 1, y: 0, scale: 1 },
  show: { opacity: 1, y: 0, scale: 1 },
};
