// services/sessionCache.js

const STORAGE_KEY_BASE = "ai-cana-session-cache";

// Cache lịch sử trải bài PHẢI tách theo user: trên trình duyệt dùng chung (hoặc sau khi đổi
// tài khoản), không được để user sau nhìn thấy tiêu đề phiên của user trước. Khoá cache được
// gắn thêm user id; user chưa đăng nhập dùng nhánh "anon".
function currentUserId() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem("user");
      if (!raw) continue;
      const id = JSON.parse(raw)?.id;
      if (id != null) return String(id);
    } catch {
      /* ignore parse errors */
    }
  }
  return "anon";
}

function storageKey() {
  return `${STORAGE_KEY_BASE}:${currentUserId()}`;
}

export function getCachedSessions() {
  // localStorage co the bi hong (ghi do dang, het quota, sua tay) khien JSON.parse nem
  // SyntaxError. Neu khong bat, loi nay lan vao saveSessionMeta (goi sau moi lan luu reading)
  // va vao fallback offline cua getReadingHistory -> hien toast loi du reading da thanh cong.
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    try {
      localStorage.removeItem(storageKey());
    } catch {
      /* ignore storage errors */
    }
    return [];
  }
}

export function saveSessionMeta(session) {
  if (!session?.sessionId) {
    return;
  }

  const existing = getCachedSessions();
  const filtered = existing.filter((s) => s.sessionId !== session.sessionId);

  localStorage.setItem(
    storageKey(),
    JSON.stringify([session, ...filtered])
  );
}

// Gọi khi đăng xuất: xoá MỌI biến thể khoá cache phiên (kể cả khoá global cũ trước khi tách
// theo user, và khoá của các user khác trên máy) để không còn lịch sử nào sót lại.
export function clearCachedSessions() {
  try {
    const staleKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key === STORAGE_KEY_BASE || key?.startsWith(`${STORAGE_KEY_BASE}:`)) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore storage errors */
  }
}
