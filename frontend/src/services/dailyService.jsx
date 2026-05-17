const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getStoredToken = () =>
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token");

const authHeaders = () => {
  const token = getStoredToken();

  if (!token) {
    throw new Error("You need to log in before using daily tarot.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const assertOk = async (response) => {
  if (response.ok) return;

  let message = "Daily API error";

  try {
    const errorBody = await response.json();
    message =
      errorBody?.detail ||
      errorBody?.message ||
      JSON.stringify(errorBody);
  } catch {
    message = await response.text();
  }

  throw new Error(message || "Daily API error");
};

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  await assertOk(response);
  return response.json();
};

export const getTodayDailyCard = async () =>
  request("/api/daily-card/today");

export const drawDailyCard = async ({
  moodPre,
  mood_pre,
} = {}) =>
  request("/api/daily-card/draw", {
    method: "POST",
    body: JSON.stringify({
      mood_pre: moodPre ?? mood_pre ?? null,
    }),
  });

export const reflectDailyCard = async (
  dailyCardId,
  {
    reflection = null,
    moodPost,
    mood_post,
  } = {}
) => {
  if (!dailyCardId) {
    throw new Error("dailyCardId is required.");
  }

  return request(`/api/daily-card/${dailyCardId}/reflect`, {
    method: "POST",
    body: JSON.stringify({
      reflection,
      mood_post: moodPost ?? mood_post ?? null,
    }),
  });
};

export const getDailyStreak = async () =>
  request("/api/daily-card/streak");

export const getDailyHistory = async ({ limit = 30 } = {}) =>
  request(`/api/daily-card/history?limit=${encodeURIComponent(limit)}`);

export const askDailyQuestion = async ({
  question = "",
  moodPre,
  mood_pre,
} = {}) => {
  const cleanQuestion = String(question || "").trim();
  const today = await getTodayDailyCard();

  if (today?.item) {
    return {
      item: today.item,
      alreadyDrawn: true,
    };
  }

  const item = await drawDailyCard({
    mood_pre: moodPre ?? mood_pre ?? (cleanQuestion || null),
  });

  return {
    item,
    alreadyDrawn: false,
  };
};
