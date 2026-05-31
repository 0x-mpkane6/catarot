/* eslint-disable react-refresh/only-export-components --
 * File này là service module thuần (export hàm helper + 1 vài component nhỏ).
 * Fast-refresh chỉ áp dụng cho component file. Không refactor lúc này.
 */
import api from "./api";

/**
 * Daily Tarot Service
 * Provides full integration with backend daily-card API endpoints
 * Features: card drawing, mood tracking, reflections, streaks, history
 */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const DEFAULT_REQUEST_TIMEOUT = 10000; // 10 seconds
const REQUEST_RETRY_COUNT = 2;
const REQUEST_RETRY_DELAY = 1000; // 1 second

/** Valid mood values accepted by backend */
export const VALID_MOODS = new Set([
  "calm",
  "anxious",
  "hopeful",
  "tired",
  "grateful",
  "uncertain",
  "joyful",
  "lonely",
  "focused",
  "sad",
  "neutral",
  "angry",
  "inspired",
]);

const DAILY_CACHE_PREFIX =
  "daily_tarot";

// ============================================================================
// UTILITY & VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates mood value against backend accepted moods
 * @param {string|null|undefined} mood - Mood to validate
 * @returns {string|null} Validated mood or null if invalid
 */
const validateMood = (mood) => {
  if (!mood) return null;
  const cleaned = String(mood).trim().toLowerCase();
  return VALID_MOODS.has(cleaned) ? cleaned : null;
};

export const getBrowserLocalDateKey = (
  date = new Date()
) => {
  const year =
    date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDailyCacheKey = (
  user,
  dateKey = getBrowserLocalDateKey()
) => {
  const userKey =
    user?.id ||
    user?.username ||
    user?.email ||
    "anonymous";

  return `${DAILY_CACHE_PREFIX}_${userKey}_${dateKey}`;
};

export const getCachedTodayDailyCard = (
  user
) => {
  try {
    const raw =
      localStorage.getItem(
        getDailyCacheKey(user)
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    logError(
      "getCachedTodayDailyCard",
      error
    );
    return null;
  }
};

export const cacheTodayDailyCard = (
  user,
  card
) => {
  if (!user || !card) return;

  try {
    localStorage.setItem(
      getDailyCacheKey(user),
      JSON.stringify(card)
    );
  } catch (error) {
    logError(
      "cacheTodayDailyCard",
      error
    );
  }
};

export const getTodayDailyReadingState =
  async (user) => {
    try {
      const data =
        await getTodayDailyCard();

      if (data?.item) {
        cacheTodayDailyCard(
          user,
          data.item
        );

        return {
          item: data.item,
          hasTodayReading: true,
          source: "api",
        };
      }
    } catch (error) {
      const status =
        error?.response?.status ??
        error?.statusCode;

      if (
        status &&
        status !== 404
      ) {
        logError(
          "getTodayDailyReadingState",
          error
        );
      }
    }

    const cached =
      getCachedTodayDailyCard(user);

    if (cached) {
      return {
        item: cached,
        hasTodayReading: true,
        source: "cache",
      };
    }

    return {
      item: null,
      hasTodayReading: false,
      source: "none",
    };
  };

/**
 * Logs error with context
 * @param {string} context - Error context/location
 * @param {Error} error - Error object
 */
const logError = (context, error) => {
  console.error(`[Daily Service] ${context}:`, error);
};

/**
 * Validates daily card response structure
 * @param {Object} data - Response data to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
const validateDailyCardResponse = (data) => {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid daily card response: not an object");
  }

  const requiredFields = [
    "id",
    "user_id",
    "draw_date",
    "card_name",
    "orientation",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Invalid daily card response: missing ${field}`);
    }
  }

  if (!["upright", "reversed"].includes(data.orientation)) {
    throw new Error(
      `Invalid orientation: ${data.orientation}, must be 'upright' or 'reversed'`
    );
  }

  return true;
};

/**
 * Validates streak response structure
 * @param {Object} data - Response data to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
const validateStreakResponse = (data) => {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid streak response: not an object");
  }

  const requiredFields = [
    "user_id",
    "current_streak",
    "longest_streak",
    "total_draws",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Invalid streak response: missing ${field}`);
    }
  }

  if (
    !Number.isInteger(data.current_streak) ||
    !Number.isInteger(data.longest_streak) ||
    !Number.isInteger(data.total_draws)
  ) {
    throw new Error("Invalid streak response: counts must be integers");
  }

  return true;
};

/**
 * Performs HTTP request with retry logic and timeout
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @param {number} retryCount - Remaining retries
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If request fails after retries
 */
const request = async (endpoint, options = {}, retryCount = REQUEST_RETRY_COUNT) => {
  try {
    const response = await api.request({
      url: endpoint,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
      timeout: options.timeout || DEFAULT_REQUEST_TIMEOUT,
    });
    return response.data;
  } catch (error) {
    // Retry on network errors but not on auth/validation errors
    if (retryCount > 0 && isRetryableError(error)) {
      await new Promise((resolve) =>
        setTimeout(resolve, REQUEST_RETRY_DELAY)
      );
      return request(endpoint, options, retryCount - 1);
    }

    logError(`request(${endpoint})`, error);
    throw error;
  }
};

/**
 * Determines if error should trigger a retry
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
const isRetryableError = (error) => {
  // axios đặt mã HTTP ở error.response.status (không phải error.statusCode).
  const status = error?.response?.status;

  // Don't retry on auth errors or validation errors
  if (status >= 400 && status < 500) {
    return false;
  }

  // Retry on network errors and server errors
  const message = error.message || "";
  return (
    message.includes("Failed to fetch") ||
    message.includes("timeout") ||
    message.includes("abort") ||
    (status && status >= 500)
  );
};

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Fetch today's daily card if already drawn
 * @returns {Promise<{item: Object|null}>} Card data or null if not drawn
 * @example
 * const result = await getTodayDailyCard();
 * if (result.item) console.log('Card:', result.item.card_name);
 */
export const getTodayDailyCard = async () => {
  try {
    const data = await request("/api/daily-card/today");

    if (data?.item) {
      validateDailyCardResponse(data.item);
    }

    return data;
  } catch (error) {
    logError("getTodayDailyCard", error);
    throw error;
  }
};

/**
 * Draw today's daily card (idempotent - returns existing if already drawn)
 * @param {Object} params - Parameters object
 * @param {string} params.moodPre - Pre-draw mood (camelCase alternative)
 * @param {string} params.mood_pre - Pre-draw mood (snake_case)
 * @returns {Promise<Object>} Daily card with affirmation
 * @throws {Error} If mood is invalid or card cannot be drawn
 * @example
 * const card = await drawDailyCard({ mood_pre: 'calm' });
 * console.log(card.affirmation);
 */
export const drawDailyCard = async ({
  moodPre,
  mood_pre,
} = {}) => {
  try {
    // Use camelCase if provided, otherwise snake_case, validate the result
    const rawMood = moodPre ?? mood_pre;
    const cleanMood = validateMood(rawMood);

    if (rawMood && !cleanMood) {
      throw new Error(
        `Invalid mood: "${rawMood}". Valid moods: ${Array.from(VALID_MOODS).join(", ")}`
      );
    }

    const response = await request("/api/daily-card/draw", {
      method: "POST",
      body: JSON.stringify({
        mood_pre: cleanMood ?? null,
      }),
    });

    validateDailyCardResponse(response);
    return response;
  } catch (error) {
    logError("drawDailyCard", error);
    throw error;
  }
};

/**
 * Add reflection and/or post-mood to today's card
 * @param {number} dailyCardId - ID of the daily card to reflect on
 * @param {Object} params - Reflection parameters
 * @param {string} params.reflection - Reflection text (optional)
 * @param {string} params.moodPost - Post-draw mood (camelCase)
 * @param {string} params.mood_post - Post-draw mood (snake_case)
 * @returns {Promise<Object>} Updated daily card
 * @throws {Error} If dailyCardId missing, no updates provided, or not found
 * @example
 * const updated = await reflectDailyCard(123, {
 *   reflection: 'Felt hopeful today',
 *   mood_post: 'grateful'
 * });
 */
export const reflectDailyCard = async (
  dailyCardId,
  {
    reflection = null,
    moodPost,
    mood_post,
  } = {}
) => {
  try {
    if (!dailyCardId) {
      throw new Error("dailyCardId is required");
    }

    if (!Number.isInteger(dailyCardId) || dailyCardId <= 0) {
      throw new Error("dailyCardId must be a positive integer");
    }

    const cleanReflection = (reflection || "").trim() || null;
    const cleanMoodPost = validateMood(moodPost ?? mood_post);

    if (!cleanReflection && !cleanMoodPost) {
      throw new Error(
        "Cần nhập chiêm nghiệm hoặc chọn tâm trạng"
      );
    }

    if (moodPost && !cleanMoodPost) {
      throw new Error(
        `Invalid mood_post: "${moodPost}". Valid moods: ${Array.from(VALID_MOODS).join(", ")}`
      );
    }

    if (mood_post && !cleanMoodPost) {
      throw new Error(
        `Invalid mood_post: "${mood_post}". Valid moods: ${Array.from(VALID_MOODS).join(", ")}`
      );
    }

    const response = await request(
      `/api/daily-card/${dailyCardId}/reflect`,
      {
        method: "POST",
        body: JSON.stringify({
          reflection: cleanReflection,
          mood_post: cleanMoodPost ?? null,
        }),
      }
    );

    validateDailyCardResponse(response);
    return response;
  } catch (error) {
    logError("reflectDailyCard", error);
    throw error;
  }
};

/**
 * Get current streak statistics for user
 * @returns {Promise<Object>} Streak data with current/longest/total
 * @example
 * const streak = await getDailyStreak();
 * console.log(`Current streak: ${streak.current_streak} days`);
 */
export const getDailyStreak = async () => {
  try {
    const data = await request("/api/daily-card/streak");
    validateStreakResponse(data);
    return data;
  } catch (error) {
    logError("getDailyStreak", error);
    throw error;
  }
};

/**
 * Get historical daily cards
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Number of cards to fetch (1-180, default 30)
 * @returns {Promise<{items: Object[]}>} Array of daily card records
 * @throws {Error} If limit is out of range
 * @example
 * const history = await getDailyHistory({ limit: 7 });
 * history.items.forEach(card => console.log(card.card_name));
 */
export const getDailyHistory = async ({ limit = 30 } = {}) => {
  try {
    const validatedLimit = Math.max(1, Math.min(180, parseInt(limit) || 30));

    const data = await request(
      `/api/daily-card/history?limit=${encodeURIComponent(validatedLimit)}`
    );

    if (!data?.items || !Array.isArray(data.items)) {
      throw new Error("Invalid history response: items is not an array");
    }

    // Validate each item
    data.items.forEach((item, index) => {
      try {
        validateDailyCardResponse(item);
      } catch (error) {
        throw new Error(`Invalid item at index ${index}: ${error.message}`);
      }
    });

    return data;
  } catch (error) {
    logError("getDailyHistory", error);
    throw error;
  }
};

/**
 * Ask a question and draw a daily card (convenience function)
 * Checks if card already drawn today, returns existing or draws new
 * @param {Object} params - Parameters object
 * @param {string} params.question - Question to ask (optional UI context)
 * @param {string} params.moodPre - Pre-draw mood (camelCase)
 * @param {string} params.mood_pre - Pre-draw mood (snake_case)
 * @returns {Promise<{item: Object, alreadyDrawn: boolean}>} Card and draw status
 * @example
 * const { item, alreadyDrawn } = await askDailyQuestion({
 *   question: 'What do I need to know today?',
 *   mood_pre: 'hopeful'
 * });
 * console.log(alreadyDrawn ? 'Reusing today\'s card' : 'New card drawn');
 */
export const askDailyQuestion = async ({
  moodPre,
  mood_pre,
} = {}) => {
  try {
    // Check if card already drawn today
    const today = await getTodayDailyCard();

    if (today?.item) {
      return {
        item: today.item,
        alreadyDrawn: true,
      };
    }

    // Draw new card. The question is UI context only; backend stores mood separately.
    const providedMood = moodPre ?? mood_pre;
    const finalMood = providedMood || null;

    const item = await drawDailyCard({
      mood_pre: finalMood,
    });

    return {
      item,
      alreadyDrawn: false,
    };
  } catch (error) {
    logError("askDailyQuestion", error);
    throw error;
  }
};

/**
 * Complete daily card workflow: draw, optionally reflect
 * Useful for atomic operations
 * @param {Object} params - Parameters object
 * @param {string} params.mood_pre - Pre-draw mood
 * @param {string} params.reflection - Optional reflection after draw
 * @param {string} params.mood_post - Optional post-draw mood
 * @returns {Promise<Object>} Updated daily card with reflection
 * @example
 * const card = await completeDailyReading({
 *   mood_pre: 'anxious',
 *   reflection: 'This card gave me clarity',
 *   mood_post: 'calm'
 * });
 */
export const completeDailyReading = async ({
  mood_pre,
  reflection,
  mood_post,
} = {}) => {
  try {
    // First, draw the card
    const card = await drawDailyCard({ mood_pre });

    // If reflection provided, add it
    if (reflection) {
      const updated = await reflectDailyCard(card.id, {
        reflection,
        mood_post,
      });
      return updated;
    }

    return card;
  } catch (error) {
    logError("completeDailyReading", error);
    throw error;
  }
};

/**
 * Check if daily card can be drawn (returns today's card or null if none drawn)
 * @returns {Promise<Object|null>} Today's card if exists, null if available to draw
 * @example
 * const existing = await canDrawDaily();
 * if (!existing) await drawDailyCard();
 */
export const canDrawDaily = async () => {
  try {
    const result = await getTodayDailyCard();
    return result?.item || null;
  } catch (error) {
    // If error is 404 or similar, card doesn't exist yet
    if (error?.response?.status === 404) {
      return null;
    }
    logError("canDrawDaily", error);
    throw error;
  }
};
