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
    username: profile?.username || "",
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