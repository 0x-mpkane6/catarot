import { create } from "zustand";
import { apiRequest } from "../lib/api";
import { createDuoSocket } from "../lib/ws";
import { useOracleStore } from "./oracleStore";

export const useDuoStore = create((set, get) => ({
  session: null,
  events: [],
  socket: null,
  loading: false,
  error: "",
  createSession: async (token) => {
    set({ loading: true, error: "", events: [] });
    try {
      const session = await apiRequest("/api/duo/sessions", { method: "POST" });
      set({ session, loading: false });
      get().connect(session.id, token);
      useOracleStore.getState().setOracleState("welcome", "Hai nguồn năng lượng đã cùng bước vào căn phòng.");
      return session;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  joinByInvite: async (inviteCode, token) => {
    set({ loading: true, error: "" });
    try {
      const session = await apiRequest("/api/duo/sessions/join_by_invite", {
        method: "POST",
        body: { invite_code: inviteCode },
      });
      set({ session, loading: false });
      get().connect(session.id, token);
      return session;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  uploadCard: async (file) => {
    const sessionId = get().session?.id;
    if (!sessionId || !file) {
      return null;
    }
    const formData = new FormData();
    formData.append("image", file);
    set({ loading: true, error: "" });
    try {
      const session = await apiRequest(`/api/duo/sessions/${sessionId}/card`, {
        method: "POST",
        body: formData,
      });
      set({ session, loading: false });
      return session;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  fetchSession: async (sessionId) => {
    set({ loading: true, error: "" });
    try {
      const session = await apiRequest(`/api/duo/sessions/${sessionId}`);
      set({ session, loading: false });
      return session;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  connect: (sessionId, token) => {
    get().disconnect();
    if (!sessionId || !token) {
      return;
    }
    const socket = createDuoSocket(sessionId, token);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const nextEvent = {
          id: `${Date.now()}-${Math.random()}`,
          type: message.type,
          at: new Date().toISOString(),
        };
        if (message.data) {
          set({ session: message.data });
        }
        set({ events: [nextEvent, ...get().events].slice(0, 12) });
      } catch {
        set({
          events: [
            { id: `${Date.now()}`, type: "message", at: new Date().toISOString() },
            ...get().events,
          ].slice(0, 12),
        });
      }
    };
    socket.onclose = () => set({ socket: null });
    set({ socket });
  },
  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.close();
    }
    set({ socket: null });
  },
  clear: () => {
    get().disconnect();
    set({ session: null, events: [], error: "", loading: false });
  },
}));
