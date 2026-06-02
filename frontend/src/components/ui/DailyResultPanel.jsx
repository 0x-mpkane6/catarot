import { useState } from "react";
import { getCardImageByName } from "../../lib/cardImages";
import useIsMobile from "../../hooks/useIsMobile";
import ReflectionModal from "./ReflectionModal";

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

const ORIENTATION_LABELS = {
  upright: "Xuôi",
  reversed: "Ngược",
};

/**
 * DailyResultPanel
 * Displays today's daily tarot card with affirmation, mood tracking, and streak info
 * Similar structure to TarotResultPanel but tailored for daily card data
 *
 * @param {Object} card - Daily card data from backend
 * @param {number} card.id - Daily card ID
 * @param {string} card.card_name - Name of the card
 * @param {string} card.orientation - 'upright' or 'reversed'
 * @param {string[]} card.keywords - Keywords/themes
 * @param {string} card.affirmation - AI-generated affirmation
 * @param {string|null} card.mood_pre - Pre-reading mood
 * @param {string|null} card.mood_post - Post-reading mood
 * @param {string|null} card.reflection - User's reflection
 * @param {number} card.streak_at_draw - Streak at time of draw
 * @param {string} card.draw_date - ISO date when card was drawn
 * @param {Function} onReflectSubmit - Callback when reflection submitted: (cardId, {reflection, mood_post})
 * @param {boolean} isLoading - Whether data is loading
 */
export default function DailyResultPanel({
  card = null,
  onReflectSubmit = () => {},
  isLoading = false,
  infoNote = "",
}) {
  const [previewExpanded, setPreviewExpanded] =
    useState(false);
  const [showReflectionModal, setShowReflectionModal] =
    useState(false);
  const [isSubmittingReflection, setIsSubmittingReflection] =
    useState(false);
  const isMobile = useIsMobile();

  /**
   * Handle reflection submit from modal
   */
  const handleReflectionSubmit = async (
    reflectionData
  ) => {
    try {
      setIsSubmittingReflection(true);
      await onReflectSubmit(
        card.daily_card_id
            || card.id
            || card.card_id,
            
        reflectionData
        );
      setShowReflectionModal(false);
    } catch (error) {
      console.error("Failed to submit reflection:", error);
      alert(
        error.message ||
          "Không thể lưu chiêm nghiệm. Vui lòng thử lại."
      );
    } finally {
      setIsSubmittingReflection(false);
    }
  };

  /**
   * Open reflection modal
   */
  const openReflectionModal = () => {
    setShowReflectionModal(true);
  };

  /**
   * Close reflection modal
   */
  const closeReflectionModal = () => {
    setShowReflectionModal(false);
  };

  /**
   * Get image path from tarot images library
   */
  const getImagePath = (cardName) => getCardImageByName(cardName);

  /**
   * Format date to readable format
   */
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Get mood badge styling
   */
  // eslint-disable-next-line no-unused-vars -- giữ chỗ để tùy biến theo mood sau
  const getMoodBadgeStyle = (mood) => ({
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "0.85rem",
    fontWeight: 600,
    marginRight: "8px",
    marginBottom: "8px",
    background: "rgba(168,85,247,0.2)",
    border: "1px solid rgba(168,85,247,0.4)",
    color: "#e9d5ff",
    textTransform: "capitalize",
  });

  if (!card) {
    return (
      <div
        style={{
          position: "fixed",
          top: "50%",
          right: "48px",
          transform: "translateY(-50%)",
          padding: "28px",
          textAlign: "center",
          color: "rgba(255,255,255,0.5)",
          fontSize: "0.95rem",
          zIndex: 40,

          // Mobile: đưa trạng thái rỗng về dòng chảy tĩnh, căn giữa.
          ...(isMobile
            ? {
                position: "static",
                right: "auto",
                top: "auto",
                transform: "none",
                width: "100%",
                margin: "76px 0 16px",
              }
            : null),
        }}
      >
        {isLoading ? "Đang tải lá bài..." : "Chưa rút lá bài nào"}
      </div>
    );
  }

  return (
    <>
      {/* SIDE CARD DISPLAY */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          right: "100px",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "160px",
          zIndex: 40,

          // Mobile: thẻ lá bài hằng ngày về dòng chảy tĩnh, căn giữa.
          ...(isMobile
            ? {
                position: "static",
                right: "auto",
                top: "auto",
                transform: "none",
                width: "100%",
                margin: "76px 0 16px",
              }
            : null),
        }}
      >
        {/* MAIN CARD IMAGE */}
        <div
          style={{
            position: "relative",
            animation:
              "floatingReveal 3s ease-in-out infinite",
          }}
        >
          {card.orientation === "reversed" && (
            <span
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                zIndex: 4,
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#fde68a",
                background: "rgba(20,10,30,0.72)",
                border: "1px solid rgba(253,230,138,0.4)",
                backdropFilter: "blur(4px)",
              }}
            >
              NGƯỢC
            </span>
          )}
          <img
            src={getImagePath(card.card_name)}
            alt={card.card_name}
            onClick={() => setPreviewExpanded(true)}
            style={{
              cursor: "pointer",
              height: isMobile ? "240px" : "340px",
              objectFit: "contain",
              borderRadius: "18px",
              transform:
                card.orientation === "reversed"
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
              transition: "0.35s ease",
              boxShadow:
                "0 0 34px rgba(192,132,252,0.22)",
              _hover: {
                boxShadow:
                  "0 0 45px rgba(192,132,252,0.35)",
              },
            }}
          />
        </div>

        {/* STREAK BADGE */}
        <div
          style={{
            marginTop: "18px",
            padding: "8px 16px",
            borderRadius: "24px",
            background:
              "rgba(34,197,94,0.15)",
            border:
              "1px solid rgba(34,197,94,0.3)",
            color: "#86efac",
            fontSize: "0.9rem",
            fontWeight: 700,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          🔥 {card.streak_at_draw} ngày{" "}
          {card.streak_at_draw !== 1 ? "chuỗi ngày" : "khởi đầu"}
        </div>

        {/* DRAW DATE */}
        <div
          style={{
            marginTop: "10px",
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
          }}
        >
          {formatDate(card.draw_date || card.created_at)}
        </div>

        {infoNote && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "14px",
              background:
                "rgba(255,255,255,0.05)",
              border:
                "1px solid rgba(192,132,252,0.16)",
              color: "#e9d5ff",
              fontSize: "0.82rem",
              lineHeight: "1.45",
              textAlign: "center",
            }}
          >
            {infoNote}
          </div>
        )}
      </div>

      {/* PREVIEW & DETAILS MODAL */}
      {previewExpanded && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: isMobile ? "100vw" : "420px",
            height: "100vh",
            zIndex: 999,
            background:
              "linear-gradient(180deg, rgba(12,8,24,0.96), rgba(7,5,16,0.98))",
            borderLeft:
              "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "-20px 0 60px rgba(192,132,252,0.14)",
            transform: previewExpanded
              ? "translateX(0%)"
              : "translateX(100%)",
            transition:
              "0.55s cubic-bezier(.16,1,.3,1)",
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            padding: "28px",
            boxSizing: "border-box",
          }}
        >
          {/* CLOSE BUTTON */}
          <button
            onClick={() => setPreviewExpanded(false)}
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background:
                "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: "1.2rem",
              transition: "0.25s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "rgba(255,255,255,0.05)";
            }}
          >
            ✕
          </button>

          {/* GLOW BACKGROUND */}
          <div
            style={{
              position: "absolute",
              top: "10%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "280px",
              height: "280px",
              borderRadius: "50%",
              background:
                "rgba(192,132,252,0.18)",
              filter: "blur(90px)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />

          {/* CONTENT */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* CARD IMAGE */}
            <img
              src={getImagePath(card.card_name)}
              alt={card.card_name}
              style={{
                width: "280px",
                height: "auto",
                marginTop: "20px",
                marginLeft: "auto",
                marginRight: "auto",
                borderRadius: "18px",
                transform:
                  card.orientation === "reversed"
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                boxShadow:
                  "0 0 45px rgba(217,70,239,0.18)",
                transition: "0.4s ease",
              }}
            />

            {/* CARD NAME */}
            <div
              style={{
                marginTop: "32px",
                color: "#fff",
                fontSize: "2rem",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {card.card_name}
            </div>

            {/* ORIENTATION */}
            <div
              style={{
                marginTop: "8px",
                color: "#d8b4fe",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontSize: "0.95rem",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              {ORIENTATION_LABELS[card.orientation] || card.orientation}
            </div>

            {/* DIVIDER */}
            <div
              style={{
                marginTop: "24px",
                height: "1px",
                background:
                  "rgba(168,85,247,0.2)",
              }}
            />

            {/* AFFIRMATION SECTION */}
            <div
              style={{
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.1em",
                  marginBottom: "12px",
                  fontWeight: 600,
                }}
              >
                Lời khẳng định
              </div>
              <div
                style={{
                  fontSize: "1.05rem",
                  lineHeight: "1.6",
                  color: "#fef3c7",
                  fontStyle: "italic",
                  borderLeft:
                    "3px solid rgba(217,70,239,0.4)",
                  paddingLeft: "16px",
                }}
              >
                {card.affirmation}
              </div>
            </div>

            {/* KEYWORDS SECTION */}
            {card.keywords &&
              card.keywords.length > 0 && (
                <div
                  style={{
                    marginTop: "24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      textTransform:
                        "uppercase",
                      color:
                        "rgba(255,255,255,0.5)",
                      letterSpacing: "0.1em",
                      marginBottom: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Từ khóa
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {card.keywords.map(
                      (keyword, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding:
                              "6px 12px",
                            borderRadius:
                              "20px",
                            fontSize:
                              "0.85rem",
                            background:
                              "rgba(59,130,246,0.15)",
                            border:
                              "1px solid rgba(59,130,246,0.3)",
                            color: "#93c5fd",
                            textTransform:
                              "capitalize",
                          }}
                        >
                          {keyword}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* MOOD SECTION */}
            <div
              style={{
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.1em",
                  marginBottom: "12px",
                  fontWeight: 600,
                }}
              >
                Tâm trạng
              </div>

              {/* PRE-MOOD */}
              <div
                style={{
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    color:
                      "rgba(255,255,255,0.6)",
                    marginBottom: "6px",
                  }}
                >
                  Trước khi trải bài
                </div>
                {card.mood_pre ? (
                  <span
                    style={getMoodBadgeStyle(
                      card.mood_pre
                    )}
                  >
                    {MOOD_LABELS[card.mood_pre] || card.mood_pre}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color:
                        "rgba(255,255,255,0.4)",
                      fontStyle: "italic",
                    }}
                  >
                    Chưa ghi nhận
                  </span>
                )}
              </div>

              {/* POST-MOOD */}
              <div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color:
                      "rgba(255,255,255,0.6)",
                    marginBottom: "6px",
                  }}
                >
                  Sau khi trải bài
                </div>
                {card.mood_post ? (
                  <span
                    style={getMoodBadgeStyle(
                      card.mood_post
                    )}
                  >
                    {MOOD_LABELS[card.mood_post] || card.mood_post}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color:
                        "rgba(255,255,255,0.4)",
                      fontStyle: "italic",
                    }}
                  >
                    Chưa ghi nhận
                  </span>
                )}
              </div>
            </div>

            {/* REFLECTION SECTION */}
            {card.reflection && (
              <div
                style={{
                  marginTop: "24px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.85rem",
                    textTransform:
                      "uppercase",
                    color:
                      "rgba(255,255,255,0.5)",
                    letterSpacing: "0.1em",
                    marginBottom: "12px",
                    fontWeight: 600,
                  }}
                >
                  Chiêm nghiệm của bạn
                </div>
                <div
                  style={{
                    fontSize: "0.95rem",
                    lineHeight: "1.6",
                    color:
                      "rgba(255,255,255,0.85)",
                    borderLeft:
                      "3px solid rgba(34,197,94,0.4)",
                    paddingLeft: "16px",
                  }}
                >
                  {card.reflection}
                </div>
              </div>
            )}

            {/* STREAK INFO */}
            <div
              style={{
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.1em",
                  marginBottom: "12px",
                  fontWeight: 600,
                }}
              >
                Chuỗi ngày
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#86efac",
                }}
              >
                {card.streak_at_draw} ngày
                {card.streak_at_draw !== 1
                  ? ""
                  : ""}{" "}
                liên tiếp
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div
              style={{
                marginTop: "32px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {/* REFLECT BUTTON */}
              <button
                onClick={() => {
                  openReflectionModal();
                  setPreviewExpanded(false);
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "16px",
                  border:
                    "1px solid rgba(168,85,247,0.3)",
                  background:
                    "rgba(168,85,247,0.15)",
                  color: "#e9d5ff",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(168,85,247,0.25)";
                  e.currentTarget.style.boxShadow =
                    "0 0 20px rgba(168,85,247,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "rgba(168,85,247,0.15)";
                  e.currentTarget.style.boxShadow =
                    "none";
                }}
              >
                {card.reflection ? "Cập nhật" : "Thêm"}{" "}
                chiêm nghiệm
              </button>

              {/* CLOSE BUTTON */}
              <button
                onClick={() =>
                  setPreviewExpanded(false)
                }
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "16px",
                  border:
                    "1px solid rgba(255,255,255,0.1)",
                  background:
                    "transparent",
                  color:
                    "rgba(255,255,255,0.7)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "transparent";
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BACKDROP */}
      {previewExpanded && (
        <div
          onClick={() =>
            setPreviewExpanded(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            zIndex: 998,
            cursor: "pointer",
          }}
        />
      )}

      {/* REFLECTION MODAL */}
      <ReflectionModal
        /* key theo định danh lá: khi đổi lá bài, React remount modal → state local
           (reflection/mood_post) tự khởi tạo lại theo lá mới, tránh hiển thị nội dung
           cũ của lá trước (modal không unmount khi đóng nên state vốn bị giữ lại). */
        key={card?.daily_card_id ?? card?.id ?? card?.card_id}
        isOpen={showReflectionModal}
        card={card}
        onSubmit={handleReflectionSubmit}
        onCancel={closeReflectionModal}
        isSubmitting={isSubmittingReflection}
      />
    </>
  );
}
