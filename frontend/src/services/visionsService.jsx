/* eslint-disable react-refresh/only-export-components --
 * File này là service module thuần, không phải component React.
 */
import api from "./api";

const ENDPOINTS = {
  createTimeCapsule:
    "/api/time-capsules",
  listTimeCapsules:
    "/api/time-capsules",
  getTimeCapsule: (capsuleId) =>
    `/api/time-capsules/${capsuleId}`,
  revealTimeCapsule: (capsuleId) =>
    `/api/time-capsules/${capsuleId}/reveal`,
  submitTimeCapsuleVerdict: (capsuleId) =>
    `/api/time-capsules/${capsuleId}/verdict`,
  createDream:
    "/api/dreams",
  listDreams:
    "/api/dreams",
  getDream: (dreamId) =>
    `/api/dreams/${dreamId}`,
};

const getErrorMessage = (error) =>
  error?.response?.data?.detail ||
  error?.response?.data?.message ||
  error?.message ||
  "Đã có lỗi xảy ra";

const normalizeTimeCapsule = (
  capsule = {}
) => ({
  id: capsule.id ?? null,
  user_id:
    capsule.user_id ?? null,
  session_id:
    capsule.session_id ?? null,
  title:
    capsule.title || "",
  question_text:
    capsule.question_text || "",
  prediction_text:
    capsule.prediction_text || "",
  cards: Array.isArray(
    capsule.cards
  )
    ? capsule.cards
    : [],
  reveal_at:
    capsule.reveal_at || null,
  status:
    capsule.status || "sealed",
  opened_at:
    capsule.opened_at || null,
  accuracy_score:
    capsule.accuracy_score ?? null,
  accuracy_note:
    capsule.accuracy_note || "",
  created_at:
    capsule.created_at || null,
  is_unlocked:
    Boolean(
      capsule.is_unlocked
    ),
  seal_message:
    capsule.seal_message || "",
});

const normalizeDreamEntry = (
  dream = {}
) => ({
  id: dream.id ?? null,
  user_id:
    dream.user_id ?? null,
  raw_text:
    dream.raw_text || "",
  transcript:
    dream.transcript || "",
  symbols: Array.isArray(
    dream.symbols
  )
    ? dream.symbols
    : [],
  mapped_arcana: Array.isArray(
    dream.mapped_arcana
  )
    ? dream.mapped_arcana
    : [],
  matches: Array.isArray(
    dream.matches
  )
    ? dream.matches
    : [],
  warnings: Array.isArray(
    dream.warnings
  )
    ? dream.warnings
    : [],
  // Diễn giải tổng hợp (mới): object hoặc null cho giấc mơ cũ chưa có.
  interpretation:
    dream.interpretation &&
    typeof dream.interpretation ===
      "object"
      ? dream.interpretation
      : null,
  created_at:
    dream.created_at || null,
});

export const createTimeCapsule =
  async ({
    title,
    reveal_at,
    revealAt,
    session_id = null,
    sessionId = null,
    question_text = null,
    questionText = null,
    prediction_text = null,
    predictionText = null,
    cards = [],
  }) => {
    const cleanTitle =
      String(title || "").trim();

    if (!cleanTitle) {
      throw new Error(
        "title is required"
      );
    }

    const revealAtValue =
      reveal_at || revealAt;

    if (!revealAtValue) {
      throw new Error(
        "reveal_at is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.createTimeCapsule,
        {
          title: cleanTitle,
          reveal_at:
            revealAtValue,
          session_id:
            session_id ??
            sessionId,
          question_text:
            question_text ??
            questionText,
          prediction_text:
            prediction_text ??
            predictionText,
          cards,
        }
      );

    return normalizeTimeCapsule(
      response.data
    );
  };

export const getTimeCapsules =
  async ({
    revealedOnly = false,
    limit = 50,
  } = {}) => {
    const response =
      await api.get(
        ENDPOINTS.listTimeCapsules,
        {
          params: {
            revealed_only:
              revealedOnly,
            limit,
          },
        }
      );

    return {
      items: Array.isArray(
        response.data?.items
      )
        ? response.data.items.map(
            normalizeTimeCapsule
          )
        : [],
    };
  };

export const getTimeCapsuleDetail =
  async (capsuleId) => {
    if (!capsuleId) {
      throw new Error(
        "capsuleId is required"
      );
    }

    const response =
      await api.get(
        ENDPOINTS.getTimeCapsule(
          capsuleId
        )
      );

    return normalizeTimeCapsule(
      response.data
    );
  };

export const revealTimeCapsule =
  async (capsuleId) => {
    if (!capsuleId) {
      throw new Error(
        "capsuleId is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.revealTimeCapsule(
          capsuleId
        )
      );

    return normalizeTimeCapsule(
      response.data
    );
  };

export const submitTimeCapsuleVerdict =
  async (
    capsuleId,
    {
      accuracy_score,
      accuracyScore,
      accuracy_note = "",
      accuracyNote = "",
    }
  ) => {
    if (!capsuleId) {
      throw new Error(
        "capsuleId is required"
      );
    }

    const score =
      accuracy_score ??
      accuracyScore;

    if (
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      throw new Error(
        "accuracy_score must be between 1 and 5"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.submitTimeCapsuleVerdict(
          capsuleId
        ),
        {
          accuracy_score:
            score,
          accuracy_note:
            String(
              accuracy_note ||
                accuracyNote ||
                ""
            ).trim() || null,
        }
      );

    return normalizeTimeCapsule(
      response.data
    );
  };

export const createDreamEntry =
  async ({
    raw_text = "",
    rawText = "",
    audio = null,
    audioFile = null,
  } = {}) => {
    const textValue =
      String(
        raw_text || rawText || ""
      ).trim();

    const finalAudio =
      audio || audioFile || null;

    if (
      !textValue &&
      !finalAudio
    ) {
      throw new Error(
        "raw_text or audio is required"
      );
    }

    const formData =
      new FormData();

    if (textValue) {
      formData.append(
        "raw_text",
        textValue
      );
    }

    if (finalAudio) {
      formData.append(
        "audio",
        finalAudio
      );
    }

    const response =
      await api.post(
        ENDPOINTS.createDream,
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

    return normalizeDreamEntry(
      response.data
    );
  };

export const getDreamEntries =
  async ({
    limit = 20,
  } = {}) => {
    const response =
      await api.get(
        ENDPOINTS.listDreams,
        {
          params: {
            limit,
          },
        }
      );

    return {
      items: Array.isArray(
        response.data?.items
      )
        ? response.data.items.map(
            normalizeDreamEntry
          )
        : [],
    };
  };

export const getDreamEntryDetail =
  async (dreamId) => {
    if (!dreamId) {
      throw new Error(
        "dreamId is required"
      );
    }

    const response =
      await api.get(
        ENDPOINTS.getDream(
          dreamId
        )
      );

    return normalizeDreamEntry(
      response.data
    );
  };

export {
  ENDPOINTS as VISIONS_ENDPOINTS,
  getErrorMessage as getVisionsErrorMessage,
  normalizeDreamEntry,
  normalizeTimeCapsule,
};
