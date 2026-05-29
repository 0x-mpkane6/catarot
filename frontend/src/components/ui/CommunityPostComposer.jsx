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

      await onSubmit?.({
        question_text:
          cleanQuestion,
        card_summary:
          parseCardSummary(
            cardSummaryText
          ),
      });

      setQuestionText("");
      setCardSummaryText("");
    };

  return (
    <div className="community-card">
      <div className="community-panel__eyebrow">
        Share A Reading
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "1.2rem",
          fontWeight: 800,
        }}
      >
        Ask the community for insight
      </div>

      <div className="community-field__hint">
        Your post enters moderation first. Once approved,
        other seekers can offer interpretations.
      </div>

      <form
        className="community-form"
        onSubmit={handleSubmit}
        style={{ marginTop: "18px" }}
      >
        <div>
          <label className="community-field__label">
            Your Question
          </label>
          <textarea
            className="community-field__textarea"
            placeholder="What are you currently seeking clarity about?"
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
            Card Summary
          </label>
          <textarea
            className="community-field__textarea"
            placeholder="One card per line, for example:&#10;The Lovers - Upright&#10;The Hermit - Reversed"
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
            Optional. Each line becomes one summary chip in
            the post.
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
              ? "Submitting..."
              : "Submit To Community"}
          </button>
        </div>
      </form>
    </div>
  );
}
