import api from "./api";

export const getCurrentUser = async () => {
  const [profileResponse, streakResponse] =
    await Promise.allSettled([
      api.get("/api/auth/me"),
      api.get("/api/daily-card/streak"),
    ]);

  if (profileResponse.status !== "fulfilled") {
    throw profileResponse.reason;
  }

  const rawPayload = profileResponse.value.data;

  const profile =
    rawPayload?.user ||
    rawPayload?.profile ||
    rawPayload?.data ||
    rawPayload ||
    {};

  const streak =
    streakResponse.status === "fulfilled"
      ? Number(
          streakResponse.value.data?.current_streak ??
            streakResponse.value.data?.daily_tarot_streak ??
            0
        )
      : 0;

  return {
    // Giữ lại id từ /api/auth/me để getStoredUserId()/cache theo user còn hoạt động.
    id: profile?.id ?? null,
    // User đăng nhập bằng Google không có username → fallback display_name / phần đầu email.
    username:
      profile?.username ||
      profile?.display_name ||
      (profile?.email ? profile.email.split("@")[0] : ""),
    email: profile?.email || "",
    display_name: profile?.display_name || "",
    avatar_url: profile?.avatar_url || "",
    daily_tarot_streak: Number.isFinite(streak) ? streak : 0,
  };
};

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
  const payload = {
    email,
    password,
  };

  const cleanUsername = (username || "").trim();

  if (cleanUsername) {
    payload.username = cleanUsername;
  }

  const response = await api.post("/api/auth/register", payload);
  return response.data;
};

// Đăng nhập bằng Google: gửi id_token (JWT credential từ Google Identity Services)
// lên backend /api/auth/google. Backend xác thực rồi trả về access_token + user.
export const loginWithGoogle = async (idToken) => {
  const response = await api.post("/api/auth/google", {
    id_token: idToken,
  });

  return {
    ...response.data,
    token: response.data.access_token,
  };
};

// Quên mật khẩu: yêu cầu backend gửi hướng dẫn đặt lại tới email.
export const requestPasswordReset = async (email) => {
  const response = await api.post("/api/auth/forgot-password", {
    email,
  });
  return response.data;
};

// Đặt lại mật khẩu bằng token (backend dùng field new_password).
export const resetPassword = async (token, newPassword) => {
  const response = await api.post("/api/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return response.data;
};