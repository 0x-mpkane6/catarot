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
        Time Capsule
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "1.2rem",
          fontWeight: 800,
        }}
      >
        Seal a prediction for later
      </div>
      <div className="visions-field__hint">
        Create a reading you can only revisit after the
        reveal date. Later, rate how accurate it was.
      </div>

      <form
        className="visions-form"
        onSubmit={handleSubmit}
        style={{ marginTop: "18px" }}
      >
        <div>
          <label className="visions-field__label">
            Capsule Title
          </label>
          <input
            className="visions-field__input"
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
            placeholder="Career reading for July"
          />
        </div>

        <div>
          <label className="visions-field__label">
            Question
          </label>
          <AutoResizeTextarea
            value={questionText}
            onChange={(event) =>
              setQuestionText(
                event.target.value
              )
            }
            placeholder="What will become clear for me in the next season?"
          />
        </div>

        <div>
          <label className="visions-field__label">
            Prediction
          </label>
          <AutoResizeTextarea
            value={predictionText}
            onChange={(event) =>
              setPredictionText(
                event.target.value
              )
            }
            placeholder="Write the reading or prediction text you want to seal."
          />
        </div>

        <div>
          <label className="visions-field__label">
            Reveal At
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
            Backend requires at least 6 hours in the
            future.
          </div>
        </div>

        <div>
          <label className="visions-field__label">
            Card Summary
          </label>
          <AutoResizeTextarea
            value={cardsText}
            onChange={(event) =>
              setCardsText(
                event.target.value
              )
            }
            placeholder="Optional. One card per line."
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
              ? "Sealing..."
              : "Seal Capsule"}
          </button>
        </div>
      </form>
    </div>
  );
}
