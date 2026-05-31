import { useState } from "react";
import {
  Check,
  Shield,
  X,
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

function ModerationCard({
  post,
  onApprove,
  onReject,
  isBusy = false,
}) {
  const [reason, setReason] =
    useState("");

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

        <div className="community-card__status is-pending">
          đang chờ
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
                key={`${post.id}-mod-${index}`}
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

      <div className="community-inline-form">
        <label className="community-field__label">
          Ghi chú kiểm duyệt
        </label>
        <textarea
          className="community-field__textarea"
          placeholder="Lý do tùy chọn cho việc duyệt/từ chối..."
          value={reason}
          onChange={(event) =>
            setReason(
              event.target.value
            )
          }
          style={{
            minHeight: "90px",
          }}
        />

        <div className="community-card__actions">
          <button
            type="button"
            className="community-button community-button--success community-button--icon"
            onClick={() =>
              onApprove?.(
                post.id,
                reason
              )
            }
            disabled={isBusy}
          >
            <Check size={16} />
            <span>
              Duyệt
            </span>
          </button>

          <button
            type="button"
            className="community-button community-button--danger community-button--icon"
            onClick={() =>
              onReject?.(
                post.id,
                reason
              )
            }
            disabled={isBusy}
          >
            <X size={16} />
            <span>
              Từ chối
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommunityModerationPanel({
  items = [],
  busyMap = {},
  onApprove,
  onReject,
}) {
  if (!items.length) {
    return (
      <div className="community-card">
        <div className="community-empty">
          <Shield
            size={22}
            style={{
              marginBottom: "10px",
            }}
          />
          <br />
          Không có bài viết nào đang chờ kiểm duyệt.
        </div>
      </div>
    );
  }

  return (
    <>
      {items.map((post) => (
        <ModerationCard
          key={post.id}
          post={post}
          isBusy={
            busyMap[
              `moderate-${post.id}`
            ]
          }
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </>
  );
}
