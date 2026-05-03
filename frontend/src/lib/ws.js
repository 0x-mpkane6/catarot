import { API_BASE_URL } from "./api";

export function createDuoSocket(sessionId, token) {
  const wsBase = API_BASE_URL.replace(/^http/i, "ws");
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return new WebSocket(`${wsBase}/ws/duo/${sessionId}${query}`);
}
