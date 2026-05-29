import { useState } from "react";

/**
 * ReflectionModal
 * Modal for user to add or update reflection and mood_post for daily card
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Object} props.card - Daily card data
 * @param {string} props.card.card_name - Card name for display
 * @param {string|null} props.card.reflection - Existing reflection
 * @param {string|null} props.card.mood_post - Existing post-mood
 * @param {Function} props.onSubmit - Callback on submit: (reflection, mood_post)
 * @param {Function} props.onCancel - Callback on cancel
 * @param {boolean} props.isSubmitting - Loading state
 */
export default function ReflectionModal({
  isOpen = false,
  card = null,
  onSubmit = () => {},
  onCancel = () => {},
  isSubmitting = false,
}) {
  const [reflection, setReflection] = useState(
    card?.reflection || ""
  );
  const [moodPost, setMoodPost] = useState(
    card?.mood_post || null
  );

  const VALID_MOODS = [
    "calm",
    "anxious",
    "hopeful",
    "tired",
    "grateful",
    "uncertain",
    "joyful",
    "lonely",
    "focused",
    "sad",
    "neutral",
    "angry",
    "inspired",
  ];

  const MOOD_EMOJIS = {
    calm: "😌",
    anxious: "😰",
    hopeful: "🤞",
    tired: "😴",
    grateful: "🙏",
    uncertain: "🤔",
    joyful: "😄",
    lonely: "😔",
    focused: "🎯",
    sad: "😞",
    neutral: "😐",
    angry: "😠",
    inspired: "✨",
  };

  const handleSubmit = () => {
    const cleanReflection = reflection.trim();

    if (!cleanReflection && !moodPost) {
      alert(
        "Please enter a reflection or select a mood."
      );
      return;
    }

    onSubmit({
      reflection: cleanReflection || null,
      mood_post: moodPost || null,
    });
  };

  const handleCancel = () => {
    // Reset form
    setReflection(card?.reflection || "");
    setMoodPost(card?.mood_post || null);
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* BACKDROP */}
      <div
        onClick={handleCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 1000,
          animation: "fadeIn 0.3s ease",
        }}
      />

      {/* MODAL */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: "90%",
          maxWidth: "520px",
          maxHeight: "85vh",
          overflow: "auto",
          background:
            "linear-gradient(180deg, rgba(12,8,24,0.98), rgba(7,5,16,0.99))",
          borderRadius: "24px",
          border:
            "1px solid rgba(168,85,247,0.2)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(168,85,247,0.15)",
          padding: "40px 32px",
          boxSizing: "border-box",
          animation: "slideUp 0.4s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* GLOW */}
        <div
          style={{
            position: "absolute",
            top: "-50px",
            right: "-80px",
            width: "300px",
            height: "300px",
            background:
              "radial-gradient(circle, rgba(168,85,247,0.2), transparent 70%)",
            borderRadius: "50%",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* CONTENT */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* HEADER */}
          <div
            style={{
              marginBottom: "28px",
            }}
          >
            <h2
              style={{
                color: "#ffffff",
                fontSize: "1.8rem",
                fontWeight: 700,
                margin: "0 0 8px 0",
              }}
            >
              Reflect on Today
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "0.95rem",
                margin: 0,
              }}
            >
              {card?.card_name || "Your Card"} ✨
            </p>
          </div>

          {/* DIVIDER */}
          <div
            style={{
              height: "1px",
              background:
                "rgba(168,85,247,0.2)",
              marginBottom: "28px",
            }}
          />

          {/* REFLECTION TEXTAREA */}
          <div
            style={{
              marginBottom: "28px",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.8)",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              💭 Your Reflection
            </label>
            <textarea
              value={reflection}
              onChange={(e) =>
                setReflection(e.target.value)
              }
              placeholder="What did this card mean to you today? How did it resonate with your life?"
              style={{
                width: "100%",
                minHeight: "140px",
                padding: "14px",
                borderRadius: "12px",
                border:
                  "1px solid rgba(168,85,247,0.3)",
                background:
                  "rgba(15,10,30,0.6)",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontFamily: "inherit",
                lineHeight: "1.5",
                resize: "vertical",
                boxSizing: "border-box",
                transition: "0.25s ease",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor =
                  "rgba(168,85,247,0.6)";
                e.target.style.background =
                  "rgba(15,10,30,0.8)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor =
                  "rgba(168,85,247,0.3)";
                e.target.style.background =
                  "rgba(15,10,30,0.6)";
              }}
              disabled={isSubmitting}
            />
            <div
              style={{
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.4)",
                marginTop: "6px",
                textAlign: "right",
              }}
            >
              {reflection.length} / 2000
            </div>
          </div>

          {/* MOOD SELECTOR */}
          <div
            style={{
              marginBottom: "28px",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.8)",
                marginBottom: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              🎭 How Do You Feel Now?
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(80px, 1fr))",
                gap: "10px",
              }}
            >
              {VALID_MOODS.map((mood) => (
                <button
                  key={mood}
                  onClick={() =>
                    setMoodPost(
                      moodPost === mood
                        ? null
                        : mood
                    )
                  }
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border:
                      moodPost === mood
                        ? "2px solid rgba(168,85,247,0.8)"
                        : "1px solid rgba(168,85,247,0.2)",
                    background:
                      moodPost === mood
                        ? "rgba(168,85,247,0.25)"
                        : "rgba(168,85,247,0.08)",
                    color:
                      moodPost === mood
                        ? "#e9d5ff"
                        : "rgba(255,255,255,0.7)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (moodPost !== mood) {
                      e.currentTarget.style.background =
                        "rgba(168,85,247,0.15)";
                      e.currentTarget.style.borderColor =
                        "rgba(168,85,247,0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (moodPost !== mood) {
                      e.currentTarget.style.background =
                        "rgba(168,85,247,0.08)";
                      e.currentTarget.style.borderColor =
                        "rgba(168,85,247,0.2)";
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <span>{MOOD_EMOJIS[mood]}</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      textTransform:
                        "capitalize",
                    }}
                  >
                    {mood}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* DIVIDER */}
          <div
            style={{
              height: "1px",
              background:
                "rgba(168,85,247,0.2)",
              marginBottom: "28px",
            }}
          />

          {/* BUTTONS */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexDirection: "row-reverse",
            }}
          >
            {/* SUBMIT */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: "12px 24px",
                borderRadius: "12px",
                border: "none",
                background:
                  "linear-gradient(135deg, rgba(168,85,247,0.5), rgba(168,85,247,0.3))",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: isSubmitting
                  ? "not-allowed"
                  : "pointer",
                transition: "0.25s ease",
                opacity: isSubmitting ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, rgba(168,85,247,0.7), rgba(168,85,247,0.5))";
                  e.currentTarget.style.boxShadow =
                    "0 0 30px rgba(168,85,247,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, rgba(168,85,247,0.5), rgba(168,85,247,0.3))";
                  e.currentTarget.style.boxShadow =
                    "none";
                }
              }}
            >
              {isSubmitting
                ? "Saving..."
                : "Save Reflection"}
            </button>

            {/* CANCEL */}
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: "12px 24px",
                borderRadius: "12px",
                border:
                  "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: isSubmitting
                  ? "not-allowed"
                  : "pointer",
                transition: "0.25s ease",
                opacity: isSubmitting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background =
                    "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor =
                    "rgba(255,255,255,0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background =
                    "transparent";
                  e.currentTarget.style.borderColor =
                    "rgba(255,255,255,0.2)";
                }
              }}
            >
              Cancel
            </button>
          </div>

          {/* INFO */}
          <div
            style={{
              marginTop: "20px",
              padding: "12px 16px",
              borderRadius: "10px",
              background:
                "rgba(59,130,246,0.1)",
              border:
                "1px solid rgba(59,130,246,0.2)",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.6)",
              lineHeight: "1.4",
            }}
          >
            ℹ️ Your reflection and mood will help personalize your tarot
            experience over time.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}
