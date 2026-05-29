// export async function getReadingHistory() {

//   // fake loading
//   await new Promise((resolve) =>
//     setTimeout(resolve, 600)
//   );

//   return [
//     { id: 1, title: "Session 1" },
//     { id: 2, title: "Session 2" },
//     { id: 3, title: "Session 3" },
//     { id: 4, title: "Session 4" },
//     { id: 5, title: "Session 5" },
//     { id: 6, title: "Session 6" },
//     { id: 7, title: "Session 7" },
//     { id: 8, title: "Session 8" },
//     { id: 9, title: "Session 9" },
//     { id: 10, title: "Session 10" },

//     { id: 11, title: "Session 11" },
//     { id: 12, title: "Session 12" },
//     { id: 13, title: "Session 13" },
//     { id: 14, title: "Session 14" },
//     { id: 15, title: "Session 15" },
//     { id: 16, title: "Session 16" },
//     { id: 17, title: "Session 17" },
//     { id: 18, title: "Session 18" },
//     { id: 19, title: "Session 19" },
//     { id: 20, title: "Session 20" },
//   ];
// }


import api from "./api";

import {
  getCachedSessions,
} from "./sessionCache";

const resolveSessionId = (
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
    "Unknown error"
  );
}

const getSessionTitle = (
  questionText,
  sessionId
) =>
  String(
    questionText ||
    `Reading #${sessionId}`
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
