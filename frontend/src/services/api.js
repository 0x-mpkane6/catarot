import axios from "axios";

const baseURL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ""),
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("token");
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* ignore SSR / private mode */
  }
  return config;
});

export default api;
