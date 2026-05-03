import { create } from "zustand";
import { apiRequest } from "../lib/api";
import { useOracleStore } from "./oracleStore";

export const useDailyCardStore = create((set, get) => ({
  today: null,
  streak: null,
  history: [],
  loading: false,
  error: "",
  loadDailyData: async () => {
    set({ loading: true, error: "" });
    try {
      const [todayData, streakData, historyData] = await Promise.all([
        apiRequest("/api/daily-card/today"),
        apiRequest("/api/daily-card/streak"),
        apiRequest("/api/daily-card/history?limit=14"),
      ]);
      set({
        today: todayData.item,
        streak: streakData,
        history: historyData.items || [],
        loading: false,
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  draw: async (moodPre) => {
    set({ loading: true, error: "" });
    useOracleStore.getState().setOracleState("drawing", "Lá bài hôm nay đã chọn ngươi.");
    try {
      const today = await apiRequest("/api/daily-card/draw", {
        method: "POST",
        body: { mood_pre: moodPre || null },
      });
      set({ today, loading: false });
      useOracleStore.getState().setOracleState("celebrating");
      await get().loadDailyData();
      return today;
    } catch (error) {
      set({ error: error.message, loading: false });
      useOracleStore.getState().setOracleState("warning");
      throw error;
    }
  },
  reflect: async ({ reflection, moodPost }) => {
    const dailyId = get().today?.id;
    if (!dailyId) {
      return null;
    }
    set({ loading: true, error: "" });
    try {
      const today = await apiRequest(`/api/daily-card/${dailyId}/reflect`, {
        method: "POST",
        body: { reflection, mood_post: moodPost || null },
      });
      set({ today, loading: false });
      await get().loadDailyData();
      return today;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
