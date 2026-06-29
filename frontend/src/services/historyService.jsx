import api from "./api";

import {
  getCachedSessions,
} from "./sessionCache";

export const resolveSessionId = (
  sessionOrId
) => {
  if (
    typeof sessionOrId ===
    "object" &&
    sessionOrId !== null
  ) {
    return (
      sessionOrId.sessionId ??
      sessionOrId.id ??
      null
    );
  }

  return sessionOrId;
};

export function
getApiErrorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "Lỗi không xác định"
  );
}

const getSessionTitle = (
  questionText,
  sessionId
) =>
  String(
    questionText ||
    `Trải bài #${sessionId}`
  ).trim();

const mapSessionSummary = (
  session
) => ({
  sessionId: session.id,
  title: getSessionTitle(
    session.question_text,
    session.id
  ),
  status: session.status,
  createdAt:
    session.created_at,
  cardCount:
    session.card_count ?? 0,
});

export async function
getReadingHistory(
  {
    limit = 20,
    offset = 0,
  } = {}
) {

  try {
    const response =
      await api.get(
        "/api/sessions",
        {
          params: {
            limit,
            offset,
          },
        }
      );

    return (
      response.data?.items || []
    ).map(mapSessionSummary);
  } catch (error) {

    // 401/403: phiên hết hạn hoặc không có quyền → KHÔNG trả cache (tránh hiện lịch sử cũ của
    // user trước sau khi đăng xuất / đổi tài khoản). Chỉ fallback cache khi lỗi mạng/khác.
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      return [];
    }

    console.error(
      "Failed to load sessions from API, falling back to cache.",
      error
    );

    return getCachedSessions();
  }
}

export async function
getSessionDetail(
  sessionOrId
) {
  const sessionId =
    resolveSessionId(
      sessionOrId
    );

  const response =
    await api.get(
      `/api/sessions/${sessionId}`
    );

  const session =
    response.data || {};

  return {
    sessionId: session.id,
    title: getSessionTitle(
      session.question_text,
      session.id
    ),
    questionText:
      session.question_text || "",
    status: session.status,
    createdAt:
      session.created_at,
    cards:
      session.cards || [],
    finalAnswer:
      session.final_answer || "",
  };
}

export async function
getConversation(
  sessionOrId,
  limit = 20
) {
  const sessionId =
    resolveSessionId(
      sessionOrId
    );

  const response =
    await api.get(
      `/api/sessions/${sessionId}/conversation`,
      {
        params: { limit },
      }
    );

  return response.data;
}

export async function
getConversationSafe(
  sessionOrId,
  limit = 20
) {
  try {
    return await getConversation(
      sessionOrId,
      limit
    );
  } catch (error) {
    console.warn(
      "Failed to load conversation, continuing with session detail only.",
      error
    );
    return {
      session_id:
        resolveSessionId(
          sessionOrId
        ),
      turns: [],
    };
  }
}

export function
buildSessionMessages(
  sessionDetail,
  conversation
) {

  const messages = [];

  if (
    sessionDetail?.questionText
  ) {
    messages.push({
      role: "user",
      content:
        sessionDetail.questionText,
    });
  }

  if (
    sessionDetail?.finalAnswer
  ) {
    messages.push({
      role: "assistant",
      content:
        sessionDetail.finalAnswer,
    });
  }

  for (const turn of
    conversation?.turns || []) {
    messages.push({
      role: turn.role,
      content:
        turn.content,
    });
  }

  return messages;
}
