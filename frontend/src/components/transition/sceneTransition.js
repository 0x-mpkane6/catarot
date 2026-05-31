/**
 * Bộ phát "chuyển cảnh" cho các chuyển đổi TRONG TRANG (không đổi route).
 *
 * Dùng để bấm danh mục / chọn lá bài trong HomePage cũng phát hiệu ứng xoáy
 * giống lúc chuyển route. Host (CosmicVeil) đăng ký 1 subscriber; nếu chưa có
 * host (vd reduced-motion chưa mount) thì vẫn chạy onCover để state được swap.
 *
 * playScene({ onCover }):
 *   onCover() sẽ được gọi ĐÚNG LÚC tấm xoáy che kín màn hình, để việc đổi nội dung
 *   diễn ra khi đang bị che → người dùng chỉ thấy cảnh mới hiện ra khi xoáy tan.
 */
let subscriber = null;

export function subscribeScene(fn) {
  subscriber = fn;
  return () => {
    if (subscriber === fn) subscriber = null;
  };
}

export function playScene(opts = {}) {
  if (subscriber) {
    subscriber(opts);
  } else if (typeof opts.onCover === "function") {
    // Không có host (vd SSR / chưa mount) → vẫn đổi nội dung ngay để không kẹt.
    opts.onCover();
  }
}
