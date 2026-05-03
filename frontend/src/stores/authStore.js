import { create } from "zustand";
import { apiRequest } from "../lib/api";
import { clearStoredAuth, getStoredAuth, saveStoredAuth } from "../lib/auth";

const stored = getStoredAuth();

export const useAuthStore = create((set, get) => ({
  token: stored?.token || "",
  user: stored?.user || null,
  loading: false,
  error: "",
  isAuthenticated: Boolean(stored?.token),
  login: async (email, password) => {
    set({ loading: true, error: "" });
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      const payload = { token: data.access_token, user: data.user };
      saveStoredAuth(payload);
      set({ ...payload, isAuthenticated: true, loading: false });
      return payload;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  register: async (email, password) => {
    set({ loading: true, error: "" });
    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: { email, password, role: "member" },
        auth: false,
      });
      set({ loading: false });
      return await get().login(email, password);
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  restore: async () => {
    if (!get().token) {
      return;
    }
    set({ loading: true });
    try {
      const user = await apiRequest("/api/auth/me");
      const payload = { token: get().token, user };
      saveStoredAuth(payload);
      set({ user, isAuthenticated: true, loading: false, error: "" });
    } catch {
      get().logout();
    }
  },
  logout: () => {
    clearStoredAuth();
    set({ token: "", user: null, isAuthenticated: false, loading: false, error: "" });
  },
}));
