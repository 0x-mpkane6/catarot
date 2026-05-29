import api from "./api";

export const login = async (email, password) => {
  const response = await api.post("/api/auth/login", {
    email,
    password,
  });

  return {
    ...response.data,
    token: response.data.access_token,
  };
};

export const register = async (email, password, username) => {
  // Backend luôn tạo role 'member'; không gửi role từ client. Username là tùy chọn.
  const payload = { email, password };
  const cleanUsername = (username || "").trim();
  if (cleanUsername) {
    payload.username = cleanUsername;
  }

  const response = await api.post("/api/auth/register", payload);
  return response.data;
};
