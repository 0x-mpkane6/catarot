// CHẾ ĐỘ XEM THỬ — CHỈ DÀNH CHO DEV (import.meta.env.DEV).
// Mục đích: xem được các màn SAU đăng nhập ở khổ điện thoại mà không cần backend
// thật (giả đăng nhập + dữ liệu mẫu) để kiểm layout responsive trước khi deploy.
//
// AN TOÀN: mọi thứ ở đây đều bọc trong import.meta.env.DEV. Khi `vite build`
// (production) → import.meta.env.DEV = false → các nhánh dùng nó bị loại bỏ
// (dead-code elimination) → KHÔNG có đường vòng đăng nhập nào lọt vào bản thật.
// Kích hoạt: chạy `npm run dev` rồi mở URL có ?preview (vd /home?preview).

export const isDevPreview = () =>
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).has("preview") ||
    window.localStorage.getItem("__devPreview") === "1");

export const DEV_USER = {
  id: 1,
  username: "demo",
  display_name: "Người Xem Thử",
  email: "demo@catarot.me",
  role: "user",
  is_admin: false,
};

// Adapter giả lập cho axios: trả dữ liệu mẫu theo URL, KHÔNG gọi mạng thật
// (tránh CORS/401 khi chạy local). Đủ để render shell + empty state mọi màn.
export function devMockAdapter(config) {
  const url = String(config.url || "");
  const reply = (data, status = 200) =>
    Promise.resolve({
      data,
      status,
      statusText: "OK",
      headers: {},
      config,
      request: {},
    });

  const emptyList = { items: [], total: 0, page: 1, page_size: 20 };

  if (/\/api\/auth\/(me|profile)/.test(url) || /\/me$/.test(url)) return reply(DEV_USER);
  if (/streak/.test(url)) return reply({ current_streak: 3, longest_streak: 7, today_done: false });
  if (/\/api\/duo/.test(url)) return reply(null); // chưa có phiên đôi nào
  if (/history|reflection|dream|session|feed|vision|oracle|rating|notification|suggestion|community/.test(url))
    return reply(emptyList);

  // Mặc định: object rỗng (dễ tính, tránh crash khi component đọc field).
  return reply({});
}
