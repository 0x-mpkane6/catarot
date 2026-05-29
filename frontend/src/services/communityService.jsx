/* eslint-disable react-refresh/only-export-components --
 * File này là service module thuần (export hàm helper/constants),
 * không phải component React.
 */
import api from "./api";

const ENDPOINTS = {
  createPost: "/api/community/posts",
  feed: "/api/community/feed",
  addInterpretation: (postId) =>
    `/api/community/posts/${postId}/interpretations`,
  voteInterpretation: (interpretationId) =>
    `/api/community/interpretations/${interpretationId}/vote`,
  resonateInterpretation: (interpretationId) =>
    `/api/community/interpretations/${interpretationId}/resonate`,
  moderationQueue:
    "/api/admin/community/moderation_queue",
  approvePost: (postId) =>
    `/api/admin/community/posts/${postId}/approve`,
  rejectPost: (postId) =>
    `/api/admin/community/posts/${postId}/reject`,
};

const getErrorMessage = (error) =>
  error?.response?.data?.detail ||
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong";

const normalizePost = (post = {}) => ({
  id: post.id ?? null,
  question_text:
    post.question_text || "",
  card_summary:
    Array.isArray(post.card_summary)
      ? post.card_summary
      : [],
  status:
    post.status || "pending",
  anonymous_alias:
    post.anonymous_alias || "",
  created_at:
    post.created_at || null,
  approved_at:
    post.approved_at || null,
  rejected_at:
    post.rejected_at || null,
  interpretations: Array.isArray(
    post.interpretations
  )
    ? post.interpretations.map(
        normalizeInterpretation
      )
    : [],
});

function normalizeInterpretation(
  interpretation = {}
) {
  return {
    id:
      interpretation.id ?? null,
    post_id:
      interpretation.post_id ?? null,
    content:
      interpretation.content || "",
    vote_count:
      Number(
        interpretation.vote_count ?? 0
      ) || 0,
    resonated_by_post_owner:
      Boolean(
        interpretation.resonated_by_post_owner
      ),
    created_at:
      interpretation.created_at || null,
  };
}

export const getCommunityFeed =
  async ({
    page = 1,
    pageSize = 20,
  } = {}) => {
    const response =
      await api.get(
        ENDPOINTS.feed,
        {
          params: {
            page,
            page_size: pageSize,
          },
        }
      );

    const payload =
      response.data || {};

    return {
      page:
        payload.page || page,
      page_size:
        payload.page_size ||
        pageSize,
      items: Array.isArray(
        payload.items
      )
        ? payload.items.map(
            normalizePost
          )
        : [],
    };
  };

export const createCommunityPost =
  async ({
    question_text,
    questionText,
    card_summary = [],
    cardSummary,
  }) => {
    const cleanQuestion =
      String(
        question_text ??
          questionText ??
          ""
      ).trim();

    if (!cleanQuestion) {
      throw new Error(
        "question_text is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.createPost,
        {
          question_text:
            cleanQuestion,
          card_summary:
            Array.isArray(
              cardSummary
            )
              ? cardSummary
              : card_summary,
        }
      );

    return normalizePost(
      response.data
    );
  };

export const addCommunityInterpretation =
  async (
    postId,
    content
  ) => {
    const cleanContent =
      String(content || "").trim();

    if (!postId) {
      throw new Error(
        "postId is required"
      );
    }

    if (!cleanContent) {
      throw new Error(
        "content is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.addInterpretation(
          postId
        ),
        {
          content:
            cleanContent,
        }
      );

    return normalizeInterpretation(
      response.data
    );
  };

export const voteCommunityInterpretation =
  async (
    interpretationId
  ) => {
    if (!interpretationId) {
      throw new Error(
        "interpretationId is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.voteInterpretation(
          interpretationId
        )
      );

    return {
      interpretation_id:
        response.data
          ?.interpretation_id ??
        interpretationId,
      vote_count:
        Number(
          response.data?.vote_count ??
            0
        ) || 0,
      created: Boolean(
        response.data?.created
      ),
    };
  };

export const resonateCommunityInterpretation =
  async (
    interpretationId
  ) => {
    if (!interpretationId) {
      throw new Error(
        "interpretationId is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.resonateInterpretation(
          interpretationId
        )
      );

    return {
      interpretation_id:
        response.data
          ?.interpretation_id ??
        interpretationId,
      resonated_by_post_owner:
        Boolean(
          response.data
            ?.resonated_by_post_owner
        ),
    };
  };

export const getCommunityModerationQueue =
  async ({
    limit = 50,
  } = {}) => {
    const response =
      await api.get(
        ENDPOINTS.moderationQueue,
        {
          params: { limit },
        }
      );

    return {
      items: Array.isArray(
        response.data?.items
      )
        ? response.data.items.map(
            normalizePost
          )
        : [],
    };
  };

export const approveCommunityPost =
  async (
    postId,
    reason = null
  ) => {
    if (!postId) {
      throw new Error(
        "postId is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.approvePost(
          postId
        ),
        {
          reason:
            reason?.trim?.() ||
            null,
        }
      );

    return normalizePost(
      response.data
    );
  };

export const rejectCommunityPost =
  async (
    postId,
    reason = null
  ) => {
    if (!postId) {
      throw new Error(
        "postId is required"
      );
    }

    const response =
      await api.post(
        ENDPOINTS.rejectPost(
          postId
        ),
        {
          reason:
            reason?.trim?.() ||
            null,
        }
      );

    return normalizePost(
      response.data
    );
  };

export {
  ENDPOINTS as COMMUNITY_ENDPOINTS,
  getErrorMessage as getCommunityErrorMessage,
  normalizePost as normalizeCommunityPost,
  normalizeInterpretation as normalizeCommunityInterpretation,
};
