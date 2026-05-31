import { useState } from "react";
import {
  Lock,
  LockOpen,
  Sparkles,
  Star,
} from "lucide-react";

const formatDateTime = (value) => {
  if (!value) return "Không rõ thời gian";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const getCardLabel = (card) =>
  card?.name ||
  card?.label ||
  "Lá bài chưa đặt tên";

// Nhãn tiếng Việt cho trạng thái hộp (giữ nguyên key tiếng Anh cho className/logic).
const STATUS_LABELS = {
  sealed: "Đã niêm phong",
  revealed: "Đã hé lộ",
  opened: "Đã mở",
  verified: "Đã xác minh",
};

const statusLabel = (status) => STATUS_LABELS[status] || status;

export default function TimeCapsuleCard({
  capsule,
  onReveal,
  onSubmitVerdict,
  busyMap = {},
}) {
  const [score, setScore] =
    useState(
      capsule.accuracy_score ?? 3
    );
  const [note, setNote] =
    useState(
      capsule.accuracy_note || ""
    );

  const isSealed =
    capsule.status === "sealed";
  const canReveal =
    capsule.is_unlocked &&
    isSealed;
  const canSubmitVerdict =
    capsule.is_unlocked &&
    capsule.status !==
      "verified";

  return (
    <div className="visions-card">
      <div className="visions-card__header">
        <div>
          <div className="visions-card__title">
            {capsule.title}
          </div>
          <div className="visions-card__meta">
            Hé lộ vào{" "}
            {formatDateTime(
              capsule.reveal_at
            )}
          </div>
        </div>

        <div
          className={`visions-card__status is-${capsule.status}`}
        >
          {statusLabel(capsule.status)}
        </div>
      </div>

      <div className="visions-card__grid">
        <div className="visions-card__cell">
          <div className="visions-card__cell-label">
            Ngày hé lộ
          </div>
          <div className="visions-card__cell-value">
            {formatDateTime(
              capsule.reveal_at
            )}
          </div>
        </div>

        <div className="visions-card__cell">
          <div className="visions-card__cell-label">
            Đã mở
          </div>
          <div className="visions-card__cell-value">
            {capsule.opened_at
              ? formatDateTime(
                  capsule.opened_at
                )
              : "Chưa mở"}
          </div>
        </div>
      </div>

      <div className="visions-card__section-title">
        Trạng thái hộp
      </div>

      <div className="visions-card__body">
        {isSealed &&
        !capsule.is_unlocked
          ? capsule.seal_message ||
            "Trải bài này vẫn đang được niêm phong."
          : capsule.question_text ||
            "Hộp đã được mở khóa."}
      </div>

      {!isSealed && (
        <>
          <div className="visions-card__section-title">
            Dự đoán
          </div>
          <div className="visions-card__body">
            {capsule.prediction_text}
          </div>

          {capsule.cards?.length >
            0 && (
            <div className="visions-card__chips">
              {capsule.cards.map(
                (card, index) => (
                  <div
                    key={`${capsule.id}-card-${index}`}
                    className="visions-card__chip"
                  >
                    {getCardLabel(
                      card
                    )}
                    {card?.orientation
                      ? ` • ${card.orientation}`
                      : ""}
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      <div
        className="visions-actions"
        style={{ marginTop: "18px" }}
      >
        <button
          type="button"
          className="visions-button visions-button--icon"
          onClick={() =>
            onReveal?.(capsule.id)
          }
          disabled={
            !canReveal ||
            busyMap[
              `reveal-${capsule.id}`
            ]
          }
        >
          {isSealed ? (
            <LockOpen size={16} />
          ) : (
            <Lock size={16} />
          )}
          <span>
            {capsule.is_unlocked
              ? "Mở hộp"
              : "Vẫn niêm phong"}
          </span>
        </button>
      </div>

      {capsule.is_unlocked && (
        <div className="visions-inline-form">
          <div className="visions-card__section-title">
            Đánh giá độ chính xác
          </div>

          <select
            className="visions-field__select"
            value={score}
            onChange={(event) =>
              setScore(
                Number(
                  event.target.value
                )
              )
            }
            disabled={
              !canSubmitVerdict
            }
          >
            {[1, 2, 3, 4, 5].map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value} / 5
                </option>
              )
            )}
          </select>

          <textarea
            className="visions-field__textarea"
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value
              )
            }
            placeholder="Khi thực tế xảy ra, bạn thấy điều này chính xác đến đâu?"
            style={{
              minHeight: "94px",
            }}
            disabled={
              !canSubmitVerdict
            }
          />

          <div className="visions-actions">
            <button
              type="button"
              className="visions-button visions-button--primary visions-button--icon"
              onClick={() =>
                onSubmitVerdict?.(
                  capsule.id,
                  {
                    accuracy_score:
                      score,
                    accuracy_note:
                      note,
                  }
                )
              }
              disabled={
                !canSubmitVerdict ||
                busyMap[
                  `verdict-${capsule.id}`
                ]
              }
            >
              <Star size={16} />
              <span>
                {capsule.status ===
                "verified"
                  ? "Đã xác minh"
                  : "Lưu đánh giá"}
              </span>
            </button>

            {capsule.accuracy_score !=
              null && (
              <div className="visions-card__meta">
                Điểm đã lưu:{" "}
                {
                  capsule.accuracy_score
                }
                /5
              </div>
            )}
          </div>
        </div>
      )}

      {capsule.accuracy_note && (
        <>
          <div className="visions-card__section-title">
            Ghi chú đã lưu
          </div>
          <div className="visions-card__body">
            <Sparkles
              size={14}
              style={{
                marginRight: "8px",
              }}
            />
            {capsule.accuracy_note}
          </div>
        </>
      )}
    </div>
  );
}
