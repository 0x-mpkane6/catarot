import { create } from "zustand";
import { apiRequest } from "../lib/api";
import { useOracleStore } from "./oracleStore";

const RECENT_KEY = "oracle_chamber_recent_readings";

function loadRecentReadings() {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentReadings(items) {
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 8)));
}

const readingSteps = [
  "Đang lắng nghe câu hỏi...",
  "Đang nhận diện lá bài...",
  "Đang truy tìm ý nghĩa...",
  "Đang giải mã thông điệp...",
  "Nữ tiên tri đang cất lời...",
];

export const useReadingStore = create((set, get) => ({
  result: null,
  cards: [],
  loading: false,
  activeStep: 0,
  error: "",
  recentReadings: loadRecentReadings(),
  resetReading: () => set({ result: null, cards: [], error: "", activeStep: 0 }),
  submitReading: async ({ question, imageFiles = [], audioFile = null, randomDraw = false }) => {
    const cleanQuestion = (question || "").trim();
    if (!cleanQuestion) {
      const message = "Hãy đặt một câu hỏi để căn phòng có thể lắng nghe.";
      set({ error: message });
      useOracleStore.getState().setOracleState("warning", message);
      throw new Error(message);
    }

    const formData = new FormData();
    formData.append("question", cleanQuestion);
    formData.append("spread_type", "three");
    formData.append("random_draw", randomDraw ? "true" : "false");
    formData.append("rating_reminder_days", "7");
    imageFiles.forEach((file) => formData.append("image", file));
    if (audioFile) {
      formData.append("audio", audioFile);
    }

    let stepTimer = null;
    set({ loading: true, activeStep: 0, error: "", result: null, cards: [] });
    useOracleStore.getState().setOracleState("listening");

    if (typeof window !== "undefined") {
      stepTimer = window.setInterval(() => {
        const nextStep = Math.min(get().activeStep + 1, readingSteps.length - 1);
        set({ activeStep: nextStep });
        if (nextStep === 2) {
          useOracleStore.getState().setOracleState("thinking");
        }
        if (nextStep === 3) {
          useOracleStore.getState().setOracleState("drawing");
        }
      }, 1600);
    }

    try {
      const data = await apiRequest("/api/ask_with_media", {
        method: "POST",
        body: formData,
        auth: false,
      });
      const cards = Array.isArray(data.cards) ? data.cards : [];
      const recent = [
        {
          id: data.session_id || Date.now(),
          question: data.question || cleanQuestion,
          cards,
          final_answer: data.final_answer,
          created_at: new Date().toISOString(),
        },
        ...get().recentReadings,
      ].slice(0, 8);
      saveRecentReadings(recent);
      set({
        result: data,
        cards,
        recentReadings: recent,
        activeStep: readingSteps.length - 1,
        loading: false,
      });
      useOracleStore.getState().setOracleState("revealing");
      window.setTimeout(() => useOracleStore.getState().setOracleState("speaking"), 1200);
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      useOracleStore.getState().setOracleState("warning");
      throw error;
    } finally {
      if (stepTimer) {
        window.clearInterval(stepTimer);
      }
    }
  },
}));

export { readingSteps };
