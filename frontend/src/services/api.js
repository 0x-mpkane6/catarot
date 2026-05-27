import axios from "axios";

const baseURL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ""),
});

const getStoredToken = () => {
  const storageList = [localStorage, sessionStorage];
  for (const storage of storageList) {
    const token = storage.getItem("token") || storage.getItem("access_token");
    if (token) return token;
  }
  return null;
};

api.interceptors.request.use((config) => {
  try {
    const token = getStoredToken();
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
