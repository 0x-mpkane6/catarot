// Rung phản hồi nhẹ khi chạm. Android (Chrome/TWA) hỗ trợ navigator.vibrate;
// iOS Safari không hỗ trợ nên sẽ bỏ qua an toàn. Bọc guard + try/catch để
// không bao giờ ném lỗi trên máy không cho rung.

const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/**
 * Rung theo mẫu (ms). Số đơn = rung 1 nhịp; mảng = xen kẽ rung/nghỉ.
 * @param {number | number[]} [pattern]
 */
export function haptic(pattern = 8) {
  try {
    if (canVibrate()) navigator.vibrate(pattern);
  } catch {
    // Máy/ trình duyệt từ chối rung — không sao, bỏ qua.
  }
}

// Nhịp chạm nhẹ cho thao tác thường (chọn lá, mở panel).
export const tapHaptic = () => haptic(8);

// Nhịp "thành công" cho thao tác hoàn tất (rút bài xong, lưu chiêm nghiệm).
export const successHaptic = () => haptic([0, 16, 36, 24]);
