import { useState } from "react";

const parseCardSummary = (value) =>
  String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      label: line,
    }));

export default function CommunityPostComposer({
  onSubmit,
  isSubmitting = false,
}) {
  const [questionText, setQuestionText] =
    useState("");
  const [cardSummaryText, setCardSummaryText] =
    useState("");

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      const cleanQuestion =
        questionText.trim();

      if (!cleanQuestion) {
        return;
      }

      try {
        await onSubmit?.({
          question_text:
            cleanQuestion,
          card_summary:
            parseCardSummary(
              cardSummaryText
            ),
        });

        // Chỉ xoá khi gửi thành công — API lỗi thì giữ nội dung đã viết.
        setQuestionText("");
        setCardSummaryText("");
      } catch {
        // parent đã hiện toast lỗi; giữ nguyên input để gửi lại.
      }
    };

  return (
    <div className="community-card">
      <div className="community-panel__eyebrow">
        Chia sẻ một trải bài
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "1.2rem",
          fontWeight: 800,
        }}
      >
        Hỏi cộng đồng để có thêm góc nhìn
      </div>

      <div className="community-field__hint">
        Bài viết của bạn sẽ qua kiểm duyệt trước. Sau khi được
        duyệt, những người tìm kiếm khác có thể đưa ra lời luận giải.
      </div>

      <form
        className="community-form"
        onSubmit={handleSubmit}
        style={{ marginTop: "18px" }}
      >
        <div>
          <label className="community-field__label">
            Câu hỏi của bạn
          </label>
          <textarea
            className="community-field__textarea"
            placeholder="Bạn đang muốn tìm sự sáng tỏ về điều gì?"
            value={questionText}
            onChange={(event) =>
              setQuestionText(
                event.target.value
              )
            }
          />
        </div>

        <div>
          <label className="community-field__label">
            Tóm tắt lá bài
          </label>
          <textarea
            className="community-field__textarea"
            placeholder="Mỗi dòng một lá bài, ví dụ:&#10;The Lovers - Xuôi&#10;The Hermit - Ngược"
            value={cardSummaryText}
            onChange={(event) =>
              setCardSummaryText(
                event.target.value
              )
            }
            style={{
              minHeight: "96px",
            }}
          />

          <div className="community-field__hint">
            Tùy chọn. Mỗi dòng sẽ trở thành một thẻ tóm tắt trong
            bài viết.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <button
            type="submit"
            className="community-button community-button--primary"
            disabled={
              isSubmitting ||
              !questionText.trim()
            }
          >
            {isSubmitting
              ? "Đang gửi..."
              : "Gửi đến cộng đồng"}
          </button>
        </div>
      </form>
    </div>
  );
}
