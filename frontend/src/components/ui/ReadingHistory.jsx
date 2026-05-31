import { useEffect, useState } from "react";

import { getReadingHistory } from "../../services/historyService";
import AnimatedList from "./AnimatedList";

export default function ReadingHistory({
  isOpen,
  onClose,
  onSelectSession,
  loadHistory,
  refreshKey = 0,
}) {
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
          minWidth: "360px",

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

        {/* TITLE */}
        <div
          style={{
            color: "#fff",

            fontSize: "2.2rem",
            fontWeight: 700,

            marginBottom: "26px",
          }}
        >
          Lịch Sử Xem Bài
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
            Đang tải các phiên...
          </div>
        )}
        <AnimatedList
            items={sessions.map(
            (s) => s.title
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
