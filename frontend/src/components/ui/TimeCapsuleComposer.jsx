import {
  useEffect,
  useRef,
  useState,
} from "react";

const toLocalDateTimeValue = (
  date
) => {
  const year =
    date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");
  const hours = String(
    date.getHours()
  ).padStart(2, "0");
  const minutes = String(
    date.getMinutes()
  ).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseCards = (value) =>
  String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      name: line,
    }));

function AutoResizeTextarea({
  value,
  minHeight = 110,
  maxHeight = 220,
  style,
  ...props
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height =
      `${minHeight}px`;

    const nextHeight =
      Math.min(
        Math.max(
          textarea.scrollHeight,
          minHeight
        ),
        maxHeight
      );

    textarea.style.height =
      `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight
        ? "auto"
        : "hidden";
  }, [value, minHeight, maxHeight]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={1}
      value={value}
      className="visions-field__textarea"
      style={{
        ...style,
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        height: `${minHeight}px`,
      }}
    />
  );
}

export default function TimeCapsuleComposer({
  onSubmit,
  isSubmitting = false,
}) {
  const buildDefaultRevealAt =
    () => {
      const nextDay =
        new Date();
      nextDay.setDate(
        nextDay.getDate() + 1
      );
      return toLocalDateTimeValue(
        nextDay
      );
    };

  const [title, setTitle] =
    useState("");
  const [questionText, setQuestionText] =
    useState("");
  const [predictionText, setPredictionText] =
    useState("");
  const [cardsText, setCardsText] =
    useState("");
  const [revealAt, setRevealAt] =
    useState(
      buildDefaultRevealAt
    );

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      await onSubmit?.({
        title:
          title.trim(),
        question_text:
          questionText.trim(),
        prediction_text:
          predictionText.trim(),
        reveal_at: new Date(
          revealAt
        ).toISOString(),
        cards:
          parseCards(cardsText),
      });

      setTitle("");
      setQuestionText("");
      setPredictionText("");
      setCardsText("");
      setRevealAt(
        buildDefaultRevealAt()
      );
    };

  return (
    <div className="visions-card">
      <div className="visions-panel__eyebrow">
        Hộp Thời Gian
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "1.2rem",
          fontWeight: 800,
        }}
      >
        Niêm phong một dự đoán để xem sau
      </div>
      <div className="visions-field__hint">
        Tạo một trải bài mà bạn chỉ có thể xem lại sau ngày
        hé lộ. Về sau, hãy đánh giá độ chính xác của nó.
      </div>

      <form
        className="visions-form"
        onSubmit={handleSubmit}
        style={{ marginTop: "18px" }}
      >
        <div>
          <label className="visions-field__label">
            Tiêu đề hộp
          </label>
          <input
            className="visions-field__input"
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
            placeholder="Trải bài sự nghiệp cho tháng Bảy"
          />
        </div>

        <div>
          <label className="visions-field__label">
            Câu hỏi
          </label>
          <AutoResizeTextarea
            value={questionText}
            onChange={(event) =>
              setQuestionText(
                event.target.value
              )
            }
            placeholder="Điều gì sẽ trở nên sáng tỏ với tôi trong mùa tới?"
          />
        </div>

        <div>
          <label className="visions-field__label">
            Dự đoán
          </label>
          <AutoResizeTextarea
            value={predictionText}
            onChange={(event) =>
              setPredictionText(
                event.target.value
              )
            }
            placeholder="Viết nội dung trải bài hoặc dự đoán mà bạn muốn niêm phong."
          />
        </div>

        <div>
          <label className="visions-field__label">
            Ngày hé lộ
          </label>
          <input
            type="datetime-local"
            className="visions-field__input"
            value={revealAt}
            onChange={(event) =>
              setRevealAt(
                event.target.value
              )
            }
          />
          <div className="visions-field__hint">
            Hệ thống yêu cầu thời điểm cách hiện tại ít nhất
            6 giờ.
          </div>
        </div>

        <div>
          <label className="visions-field__label">
            Tóm tắt lá bài
          </label>
          <AutoResizeTextarea
            value={cardsText}
            onChange={(event) =>
              setCardsText(
                event.target.value
              )
            }
            placeholder="Tùy chọn. Mỗi lá bài một dòng."
            minHeight={96}
            style={{
              minHeight: "96px",
            }}
          />
        </div>

        <div className="visions-actions">
          <button
            type="submit"
            className="visions-button visions-button--primary"
            disabled={
              isSubmitting ||
              !title.trim() ||
              !questionText.trim() ||
              !predictionText.trim() ||
              !revealAt
            }
          >
            {isSubmitting
              ? "Đang niêm phong..."
              : "Niêm phong hộp"}
          </button>
        </div>
      </form>
    </div>
  );
}
