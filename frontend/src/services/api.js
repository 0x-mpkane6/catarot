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
    console.log("[api] request", {
      method: config.method,
      url: config.url,
      tokenExists: Boolean(token),
    });
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* ignore SSR / private mode */
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[api] response error", {
      method: error?.config?.method,
      url: error?.config?.url,
      status: error?.response?.status,
      detail:
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message,
      hasAuthorization: Boolean(
        error?.config?.headers?.Authorization
      ),
    });
    return Promise.reject(error);
  }
);

export default api;
