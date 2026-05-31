import { useEffect, useMemo, useState } from "react";
// eslint-disable-next-line no-unused-vars -- dùng dưới dạng <motion.div>
import { motion, AnimatePresence } from "motion/react";

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

const formatDate = (value) => {
  if (!value) return "Không rõ ngày";

  try {
    return new Date(value).toLocaleDateString(
      "vi-VN",
      {
        weekday: "short",
        month: "short",
        day: "numeric",
      }
    );
  } catch {
    return value;
  }
};

const getPreviewText = (item) => {
  const reflection =
    item?.reflection?.trim() || "";

  if (reflection) {
    return reflection.length > 120
      ? `${reflection.slice(0, 120)}...`
      : reflection;
  }

  if (item?.mood_post) {
    return `Tâm trạng sau khi trải bài: ${MOOD_LABELS[item.mood_post] || item.mood_post}`;
  }

  return "Chưa lưu chiêm nghiệm nào.";
};

export default function ReflectionHistory({
  isOpen,
  onClose,
  refreshKey = 0,
  loadHistory,
}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {
    if (!isOpen || !loadHistory) return;

    const loadItems = async () => {
      try {
        setIsLoading(true);

        const data =
          await loadHistory();

        const reflections =
          (data?.items || []).filter(
            (item) =>
              item?.reflection ||
              item?.mood_post
          );

        setItems(reflections);
      } catch (error) {
        console.error(
          "Failed to load reflection history",
          error
        );
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [
    isOpen,
    loadHistory,
    refreshKey,
  ]);

  const headerText = useMemo(
    () =>
      isLoading
        ? "Đang tải chiêm nghiệm..."
        : `${items.length} chiêm nghiệm${
            items.length === 1
              ? ""
              : ""
          }`,
    [isLoading, items.length]
  );

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.28)",
          backdropFilter: "blur(6px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents:
            isOpen ? "auto" : "none",
          transition: "0.35s ease",
          zIndex: 90,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "24%",
          minWidth: "380px",
          height: "100vh",
          background:
            "linear-gradient(to bottom, rgba(15,10,30,0.92), rgba(8,5,18,0.96))",
          borderLeft:
            "1px solid rgba(168,85,247,0.14)",
          backdropFilter: "blur(24px)",
          boxShadow:
            "-20px 0 60px rgba(0,0,0,0.45)",
          transform: isOpen
            ? "translateX(0)"
            : "translateX(100%)",
          transition:
            "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 100,
          padding: "28px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: "2.2rem",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          Lịch sử chiêm nghiệm
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.58)",
            fontSize: "0.95rem",
            marginBottom: "22px",
          }}
        >
          {headerText}
        </div>

        <div
          style={{
            height: "78vh",
            overflowY: "auto",
            paddingRight: "8px",
          }}
        >
          <AnimatePresence mode="popLayout">
            {items.map(
              (item, index) => (
                <motion.div
                  key={item.id}
                  initial={{
                    opacity: 0,
                    y: 18,
                    scale: 0.97,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: -10,
                    scale: 0.98,
                  }}
                  transition={{
                    duration: 0.28,
                    delay:
                      index * 0.04,
                  }}
                  style={{
                    marginBottom: "14px",
                    padding: "16px",
                    borderRadius: "18px",
                    background:
                      "linear-gradient(180deg, rgba(34,23,58,0.72), rgba(18,12,32,0.86))",
                    border:
                      "1px solid rgba(168,85,247,0.18)",
                    boxShadow:
                      "0 12px 34px rgba(0,0,0,0.22)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                      alignItems:
                        "flex-start",
                    }}
                  >
                    <div
                      style={{
                        color: "#fff",
                        fontSize: "1rem",
                        fontWeight: 700,
                      }}
                    >
                      {item.card_name}
                    </div>

                    <div
                      style={{
                        color:
                          "rgba(255,255,255,0.48)",
                        fontSize: "0.8rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(
                        item.draw_date ||
                          item.created_at
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "6px",
                      color: "#d8b4fe",
                      fontSize: "0.8rem",
                      textTransform:
                        "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {ORIENTATION_LABELS[item.orientation] || item.orientation}
                  </div>

                  {item.mood_post && (
                    <div
                      style={{
                        marginTop: "10px",
                        display: "inline-flex",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        background:
                          "rgba(168,85,247,0.16)",
                        border:
                          "1px solid rgba(168,85,247,0.22)",
                        color: "#f3d0ff",
                        fontSize: "0.78rem",
                        textTransform:
                          "capitalize",
                      }}
                    >
                      {MOOD_LABELS[item.mood_post] || item.mood_post}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: "12px",
                      color:
                        "rgba(255,255,255,0.78)",
                      lineHeight: 1.6,
                      fontSize: "0.93rem",
                    }}
                  >
                    {getPreviewText(item)}
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>

          {!isLoading &&
            items.length === 0 && (
              <div
                style={{
                  marginTop: "48px",
                  color:
                    "rgba(255,255,255,0.45)",
                  textAlign: "center",
                  lineHeight: 1.7,
                }}
              >
                Chưa có chiêm nghiệm nào.
                <br />
                Hãy lưu một chiêm nghiệm từ kết quả Tarot Hằng Ngày của bạn để xem tại đây.
              </div>
            )}
        </div>
      </div>
    </>
  );
}
