import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { getReadingHistory } from "../../services/historyService";
import AnimatedList from "./AnimatedList";
import { useAppSettings } from "../../context/AppSettingsContext";

const MAX_HISTORY_TITLE_LENGTH = 72;

function truncateHistoryTitle(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= MAX_HISTORY_TITLE_LENGTH) return text;
  return `${text.slice(0, MAX_HISTORY_TITLE_LENGTH).trimEnd()}...`;
}

export default function ReadingHistory({
  isOpen,
  onClose,
  onSelectSession,
  loadHistory,
  refreshKey = 0,
}) {
  const { t } = useAppSettings();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {

    if (!isOpen) return;

    const fetchHistory = async () => {
      try {
        setIsLoading(true);

        const data =
          await (loadHistory
            ? loadHistory()
            : getReadingHistory());

        setSessions(data || []);
      } catch (error) {
        // Không nuốt lỗi âm thầm: báo người dùng + đưa danh sách về rỗng rõ ràng.
        console.error("Không tải được lịch sử xem bài", error);
        toast.error(t("history_load_failed"));
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();

  }, [
    isOpen,
    loadHistory,
    refreshKey,
  ]);

  return (
    <>
      {/* BACKDROP */}
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

      {/* PANEL */}
      <div
        style={{
          position: "fixed",

          top: 0,
          right: 0,

          width: "22%",
          minWidth: "min(360px, 100vw)",

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
        }}
      >

        {/* Nút đóng (trước đây chỉ đóng được bằng backdrop — bị panel full màn che). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          style={{
            position: "fixed",
            top: "calc(12px + env(safe-area-inset-top, 0px))",
            right: "12px",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(20,12,36,0.65)",
            color: "#fff",
            fontSize: "20px",
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 5,
          }}
        >
          ✕
        </button>

        {/* TITLE */}
        <div
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            color: "#fff",

            fontSize: "2.2rem",
            fontWeight: 700,

            marginBottom: "26px",
          }}
        >
          {t("history_title")}
        </div>

        {/* SESSION LIST */}
        <div
        style={{
            height: "75vh",
        }}
        >
        {isLoading && (
          <div
            style={{
              color:
                "rgba(255,255,255,0.56)",
              marginBottom: "14px",
            }}
          >
            {t("history_loading")}
          </div>
        )}
        <AnimatedList
            items={sessions.map(
            (s) => truncateHistoryTitle(s.title) || t("history_untitled")
            )}

          onItemSelect={(item, index) => {

            onSelectSession?.(
              sessions[index]
            );
          }}
        />
        </div>
      </div>
    </>
  );
}
