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

  return {
    audioBlob: response.data,
    contentType: response.headers?.["content-type"] || "audio/wav",
    warnings: decodeWarningHeader(
      response.headers?.["x-tts-warnings"] || response.headers?.["X-TTS-Warnings"]
    ),
  };
}
