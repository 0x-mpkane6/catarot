import {
  ArrowBigUp,
} from "lucide-react";

import {
  VALID_MOODS,
} from "../../services/dailyService";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import toast from "react-hot-toast";

const moodOptions =
  Array.from(
    VALID_MOODS
  );

export default function DailyChatBox({
  disabled = false,
  onSubmit,
}) {
  const baseHeight = 28;
  const maxHeight = 180;

  const [mood, setMood] =
    useState("");

  const [question, setQuestion] =
    useState("");
  const [isMultiline, setIsMultiline] =
    useState(false);
  const textareaRef = useRef(null);

  const [showMoodMenu,
    setShowMoodMenu] =
    useState(false);

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height =
      `${baseHeight}px`;

    const nextHeight =
      Math.min(
        Math.max(
          textarea.scrollHeight,
          baseHeight
        ),
        maxHeight
      );

    textarea.style.height =
      `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight
        ? "auto"
        : "hidden";

    setIsMultiline(
      textarea.scrollHeight >
        baseHeight + 4
    );
  }, [question, baseHeight, maxHeight]);

  const handleSubmit = async () => {

    if (disabled) return;

    const trimmedMood =
      mood.trim();

    const trimmedQuestion =
      question.trim();

    if (
      !trimmedMood &&
      !trimmedQuestion
    ) {

      toast.error(
        "Please enter a mood or question"
      );

      return;
    }

    await Promise.resolve(
      onSubmit?.({
        mood_pre:
          trimmedMood,

        question:
          trimmedQuestion,
      })
    );

    setMood("");
    setQuestion("");
    setIsMultiline(false);

    setShowMoodMenu(
      false
    );
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "950px",
      }}
    >

      <div
        style={{
          width: "100%",

          padding:
            "14px 18px",

          borderRadius:
            "28px",

          background:
            "rgba(18, 10, 35, 0.88)",

          border:
            "1px solid rgba(192, 132, 252, 0.14)",

          backdropFilter:
            "blur(20px)",

          boxShadow:
            "0 0 35px rgba(168, 85, 247, 0.08)",

          display: "flex",

          alignItems:
            isMultiline
              ? "flex-end"
              : "center",

          gap: "0px",

          boxSizing:
            "border-box",
        }}
      >

        {/* mood dropdown */}
        <div
          style={{
            position: "relative",

            width: "230px",

            minWidth: "230px",
          }}
        >

          {/* trigger */}
          <button
            type="button"

            onClick={() =>
              setShowMoodMenu(
                !showMoodMenu
              )
            }

            style={{
              width: "80%",

              padding:
                "10px 12px",
              textAlign: "center",

              borderRadius:
                "18px",

              border:
                "1px solid rgba(192,132,252,0.18)",

              background:
                  "linear-gradient(135deg, #c084fc, #e879f9)",

              color: "#ffffff",

              fontSize:
                "1.0rem",

              fontWeight: 500,

              cursor: "pointer",

              backdropFilter:
                "blur(14px)",

              boxShadow:
                "0 0 20px rgba(168,85,247,0.08)",

              transition:
                "0.25s ease",
            }}
          >
            {mood || "Select mood"}
          </button>

          {/* dropdown */}
          {showMoodMenu && (

            <div
              style={{
                position:
                  "absolute",

                bottom: "58px",

                left: 0,

                width: "100%",

                maxHeight:
                  "260px",

                overflowY:
                  "auto",

                borderRadius:
                  "18px",

                overflowX:
                  "hidden",

                background:
                  "rgba(16,10,30,0.96)",

                border:
                  "1px solid rgba(192,132,252,0.16)",

                backdropFilter:
                  "blur(18px)",

                boxShadow:
                  "0 10px 40px rgba(0,0,0,0.45)",

                zIndex: 999,
              }}
            >

              {moodOptions.map(
                (item) => (

                  <div
                    key={item}

                    onClick={() => {

                      setMood(item);

                      setShowMoodMenu(
                        false
                      );
                    }}

                    style={{
                      padding:
                        "12px 14px",

                      cursor:
                        "pointer",

                      color:
                        "#fff",

                      fontSize:
                        "0.92rem",

                      transition:
                        "0.2s ease",

                      borderBottom:
                        "1px solid rgba(255,255,255,0.04)",
                    }}

                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(168,85,247,0.12)";
                    }}

                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "transparent";
                    }}
                  >
                    {item}
                  </div>

                )
              )}

            </div>

          )}

        </div>

        {/* divider */}
        <div
          style={{
            width: "1px",
            height: "10px",

            background:
              "rgba(255,255,255,0.08)",
          }}
        />

        {/* question input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={question}

          onChange={(e) =>
            setQuestion(
              e.target.value
            )
          }

          placeholder="What should I focus on today?"

          onKeyDown={async (e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey
            ) {
              e.preventDefault();
              await handleSubmit();
            }
          }}

          style={{
            flex: 1,

            background:
              "transparent",

            border: "none",

            outline: "none",

            color: "#ffffff",

            fontSize: "1rem",

            fontWeight: 500,

            fontFamily:
              "inherit",

            padding: "0 12px",
            minHeight: "28px",
            maxHeight: "180px",
            height: "28px",
            resize: "none",
            overflowY: "hidden",
            whiteSpace: "pre-wrap",
            lineHeight: "24px",
          }}
        />

        {/* send */}
        <button
          type="button"

          disabled={disabled}

          onClick={
            handleSubmit
          }

          style={{
            width: "46px",

            height: "46px",

            borderRadius:
              "50%",

            border: "none",

            background:
              "linear-gradient(135deg, #c084fc, #e879f9)",

            color: "#fff",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "center",

            cursor:
              disabled
                ? "not-allowed"
                : "pointer",

            opacity:
              disabled
                ? 0.65
                : 1,

            transition:
              "0.25s ease",

            boxShadow:
              "0 0 20px rgba(192,132,252,0.35)",
          }}
        >

          <ArrowBigUp
            size={24}
          />

        </button>

      </div>

    </div>
  );
}
