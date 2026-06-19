import { useState } from "react";
import {
  HeartHandshake,
  Sparkles,
  ThumbsUp,
} from "lucide-react";

const formatDateTime = (value) => {
  if (!value) return "Không rõ thời gian";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const getCardChipLabel = (
  item
) => {
  if (
    typeof item === "string"
  ) {
    return item;
  }

  return (
    item?.label ||
    item?.name ||
    item?.card_name ||
    item?.title ||
    JSON.stringify(item)
  );
};

export default function CommunityPostCard({
  post,
  onAddInterpretation,
  onVoteInterpretation,
  onResonateInterpretation,
  busyMap = {},
}) {
  const [draft, setDraft] =
    useState("");

  const handleInterpretationSubmit =
    async (event) => {
      event.preventDefault();

      const cleanDraft =
        draft.trim();

      if (!cleanDraft) {
        return;
      }

      try {
        await onAddInterpretation?.(
          post.id,
          cleanDraft
        );

        // Chỉ xoá khi gửi thành công.
        setDraft("");
      } catch {
        // parent đã hiện toast lỗi; giữ nguyên lời luận giải đã viết.
      }
    };

  return (
    <div className="community-card">
      <div className="community-card__header">
        <div>
          <div className="community-card__alias">
            {post.anonymous_alias ||
              `Người tìm kiếm #${post.id}`}
          </div>

          <div className="community-card__meta">
            {formatDateTime(
              post.created_at
            )}
          </div>
        </div>

        <div
          className={`community-card__status is-${post.status}`}
        >
          {post.status}
        </div>
      </div>

      <div className="community-card__question">
        {post.question_text}
      </div>

      {post.card_summary?.length >
        0 && (
        <div className="community-card__summary">
          {post.card_summary.map(
            (item, index) => (
              <div
                key={`${post.id}-summary-${index}`}
                className="community-card__summary-chip"
              >
                {getCardChipLabel(
                  item
                )}
              </div>
            )
          )}
        </div>
      )}

      <div className="community-card__section-title">
        Lời luận giải từ cộng đồng
      </div>

      {post.interpretations?.length >
      0 ? (
        post.interpretations.map(
          (interpretation) => (
            <div
              key={
                interpretation.id
              }
              className="community-card__interpretation"
            >
              <div className="community-card__interpretation-text">
                {
                  interpretation.content
                }
              </div>

              <div className="community-card__interpretation-meta">
                <div className="community-card__interpretation-time">
                  {formatDateTime(
                    interpretation.created_at
                  )}
                </div>

                <div className="community-card__actions">
                  <button
                    type="button"
                    className="community-button community-button--icon"
                    onClick={() =>
                      onVoteInterpretation?.(
                        post.id,
                        interpretation.id
                      )
                    }
                    disabled={
                      busyMap[
                        `vote-${interpretation.id}`
                      ]
                    }
                  >
                    <ThumbsUp size={16} />
                    <span>
                      {
                        interpretation.vote_count
                      }
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`community-button community-button--icon ${
                      interpretation.resonated_by_post_owner
                        ? "community-button--success"
                        : ""
                    }`}
                    onClick={() =>
                      onResonateInterpretation?.(
                        post.id,
                        interpretation.id
                      )
                    }
                    disabled={
                      interpretation.resonated_by_post_owner ||
                      busyMap[
                        `resonate-${interpretation.id}`
                      ]
                    }
                    title="Chỉ dành cho chủ bài viết"
                  >
                    <HeartHandshake
                      size={16}
                    />
                    <span>
                      {interpretation.resonated_by_post_owner
                        ? "Đã đồng cảm"
                        : "Đồng cảm"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )
        )
      ) : (
        <div className="community-empty">
          Chưa có lời luận giải nào.
          <br />
          Hãy là người đầu tiên chia sẻ góc nhìn.
        </div>
      )}

      <div className="community-divider" />

      <form
        className="community-inline-form"
        onSubmit={
          handleInterpretationSubmit
        }
      >
        <label className="community-field__label">
          Thêm lời luận giải
        </label>

        <textarea
          className="community-field__textarea"
          placeholder="Chia sẻ góc nhìn tarot của bạn với sự đồng cảm và rõ ràng..."
          value={draft}
          onChange={(event) =>
            setDraft(
              event.target.value
            )
          }
          style={{
            minHeight: "92px",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div className="community-field__hint">
            Bình chọn giúp những lời luận giải hay nhất nổi bật.
          </div>

          <button
            type="submit"
            className="community-button community-button--primary community-button--icon"
            disabled={
              !draft.trim() ||
              busyMap[
                `interpret-${post.id}`
              ]
            }
          >
            <Sparkles size={16} />
            <span>
              {busyMap[
                `interpret-${post.id}`
              ]
                ? "Đang đăng..."
                : "Chia sẻ góc nhìn"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
