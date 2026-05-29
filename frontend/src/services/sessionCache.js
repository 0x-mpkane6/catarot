// services/sessionCache.js

const STORAGE_KEY =
  "ai-cana-session-cache";

export function getCachedSessions() {
  return JSON.parse(
    localStorage.getItem(STORAGE_KEY)
      || "[]"
  );
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
