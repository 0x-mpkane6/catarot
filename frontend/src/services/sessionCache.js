// services/sessionCache.js

const STORAGE_KEY =
  "ai-cana-session-cache";

export function getCachedSessions() {
  // localStorage co the bi hong (ghi do dang, het quota, sua tay) khien JSON.parse nem
  // SyntaxError. Neu khong bat, loi nay lan vao saveSessionMeta (goi sau moi lan luu reading)
  // va vao fallback offline cua getReadingHistory -> hien toast loi du reading da thanh cong.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore storage errors */
    }
    return [];
  }
}

export function saveSessionMeta(
  session
) {
  if (!session?.sessionId) {
    return;
  }

  const existing =
    getCachedSessions();

  const filtered =
    existing.filter(
      (s) =>
        s.sessionId !==
        session.sessionId
    );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      session,
      ...filtered,
    ])
  );
}
