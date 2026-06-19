import {
  ArrowBigUp,
} from "lucide-react";

import {
  VALID_MOODS,
} from "../../services/dailyService";

import {
  useState,
} from "react";

import toast from "react-hot-toast";

import useIsMobile from "../../hooks/useIsMobile";

const moodOptions =
  Array.from(
    VALID_MOODS
  );

const MOOD_LABELS = {
  calm: "Bình thản",
  anxious: "Lo âu",
  hopeful: "Hy vọng",
  tired: "Mệt mỏi",
  grateful: "Biết ơn",
  uncertain: "Bất định",
  joyful: "Vui vẻ",
  lonely: "Cô đơn",
  focused: "Tập trung",
  sad: "Buồn",
  neutral: "Trung tính",
  angry: "Giận dữ",
  inspired: "Cảm hứng",
};

// Lá bài hằng ngày = 1 lá NGẪU NHIÊN theo tâm trạng (mỗi ngày 1 lá). Nghi thức chỉ cần chọn
// tâm trạng — KHÔNG có ô nhập câu hỏi vì lá hằng ngày không nhận câu hỏi tự do (muốn hỏi theo
// chủ đề thì dùng nút "Luận giải sâu"). Trước đây có ô câu hỏi nhưng backend bỏ qua → gây hiểu
// nhầm, nay đã lược bỏ cho đúng bản chất.
export default function DailyChatBox({
  disabled = false,
  onSubmit,
}) {
  const isMobile = useIsMobile();

  const [mood, setMood] =
    useState("");

  const [showMoodMenu,
    setShowMoodMenu] =
    useState(false);

  const handleSubmit = async () => {
    if (disabled) return;

    const trimmedMood = mood.trim();

    if (!trimmedMood) {
      toast.error(
        "Vui lòng chọn tâm trạng để rút lá hôm nay"
      );
      return;
    }

    await Promise.resolve(
      onSubmit?.({
        mood_pre: trimmedMood,
      })
    );

    setMood("");
    setShowMoodMenu(false);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: isMobile ? "100%" : "950px",
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

          alignItems: "center",

          gap: "0px",

          boxSizing:
            "border-box",
        }}
      >

        {/* mood dropdown */}
        <div
          style={{
            position: "relative",

            width: isMobile ? "150px" : "230px",

            minWidth: isMobile ? "130px" : "230px",
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
              width: isMobile ? "100%" : "80%",

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
            {(mood && (MOOD_LABELS[mood] || mood)) || "Chọn tâm trạng"}
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
                    {MOOD_LABELS[item] || item}
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

        {/* hint (không phải ô nhập — lá hằng ngày rút theo tâm trạng) */}
        <div
          style={{
            flex: 1,
            padding: "0 14px",
            color: "rgba(255,255,255,0.55)",
            fontSize: "0.95rem",
            fontWeight: 500,
            userSelect: "none",
          }}
        >
          Chọn tâm trạng rồi rút lá Tarot cho hôm nay
        </div>

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
