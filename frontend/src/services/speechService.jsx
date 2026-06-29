import api from "./api";

const TTS_ENDPOINT = "/api/tts";

function decodeWarningHeader(value) {
  if (!value) return [];

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  return decoded
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function synthesizeSpeech(text) {
  const response = await api.post(
    TTS_ENDPOINT,
    {
      text: String(text || ""),
    },
    {
      responseType: "blob",
    }
  );

  // Mốc ký tự (theo văn bản gốc) mà audio thực sự đọc tới → dùng cho karaoke khớp chữ–tiếng.
  // Thiếu header (backend cũ) → null → component fallback ánh xạ theo toàn bộ độ dài (như cũ).
  const rawSpokenEnd =
    response.headers?.["x-tts-spoken-end"] ?? response.headers?.["X-TTS-Spoken-End"];
  const spokenEnd = Number.parseInt(rawSpokenEnd, 10);

  return {
    audioBlob: response.data,
    contentType: response.headers?.["content-type"] || "audio/mpeg",
    spokenEnd: Number.isFinite(spokenEnd) && spokenEnd > 0 ? spokenEnd : null,
    warnings: decodeWarningHeader(
      response.headers?.["x-tts-warnings"] || response.headers?.["X-TTS-Warnings"]
    ),
  };
}
