import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";

import { getDeepReading } from "../../services/dailyService";
import useIsMobile from "../../hooks/useIsMobile";

/** Gợi ý chủ đề nhanh (bấm để điền vào ô nhập); người dùng vẫn gõ tự do được. */
const TOPIC_SUGGESTIONS = [
  "Tổng quan",
  "Công việc",
  "Tình cảm",
  "Học tập",
  "Tài chính",
  "Sức khỏe",
  "Các mối quan hệ",
];

/**
 * Panel "Luận giải sâu hôm nay" cho lá Daily Card.
 *
 * CHỈ gọi backend khi user bấm nút (không tự gọi khi mở trang). Hiển thị bộ chọn chủ
 * đề, nút luận giải, trạng thái loading, kết quả Markdown và badge khi dùng bản đã lưu.
 * Lỗi được báo thân thiện (toast + dòng thông báo) chứ không làm sập trang.
 *
 * @param {Object} props
 * @param {Object|null} props.card - Lá Daily Card hôm nay (cần card_name để hiển thị).
 */
export default function DeepReadingPanel({ card = null }) {
  const isMobile = useIsMobile();
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Lá bài đổi (sang ngày mới / rút lại) → reset toàn bộ trạng thái luận giải.
  const cardKey = card?.id ?? card?.draw_date ?? card?.card_name ?? null;
  useEffect(() => {
    setResult(null);
    setError("");
    setTopic("");
  }, [cardKey]);

  if (!card || !card.card_name) {
    return null;
  }

  const applySuggestion = (label) => {
    setTopic(label);
    // Kết quả cũ thuộc chủ đề khác → xoá để tránh hiển thị lệch chủ đề.
    setResult(null);
    setError("");
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getDeepReading({ topic });
      setResult(data);
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        "Không lấy được luận giải sâu lúc này. Bạn thử lại sau một chút nhé.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTopicLabel = topic.trim() || "Tổng quan";

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "60px",
        transform: "translateY(-50%)",
        width: "440px",
        maxWidth: "calc(100vw - 120px)",
        maxHeight: "80vh",
        overflowY: "auto",
        zIndex: 35,
        padding: "22px 24px",
        borderRadius: "22px",
        background:
          "linear-gradient(180deg, rgba(24,16,42,0.92), rgba(12,8,24,0.95))",
        border: "1px solid rgba(192,132,252,0.22)",
        boxShadow: "0 20px 60px rgba(120,70,200,0.25)",
        backdropFilter: "blur(20px)",
        color: "#e9d5ff",
        boxSizing: "border-box",

        // Mobile: về dòng chảy tĩnh, full width.
        ...(isMobile
          ? {
              position: "static",
              top: "auto",
              left: "auto",
              transform: "none",
              width: "100%",
              maxWidth: "100%",
              maxHeight: "none",
              margin: "8px 0 24px",
            }
          : null),
      }}
    >
      {/* HEADER */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            fontSize: "1.05rem",
            fontWeight: 700,
            letterSpacing: "0.01em",
            color: "#f5e9ff",
          }}
        >
          Luận giải sâu hôm nay
        </div>
        <div
          style={{
            marginTop: "4px",
            fontSize: "0.82rem",
            color: "rgba(233,213,255,0.7)",
          }}
        >
          {card.card_name}
          {card.orientation === "reversed" ? " (ngược)" : " (xuôi)"} ·{" "}
          {activeTopicLabel}
        </div>
      </div>

      {/* TOPIC INPUT (chủ đề tự do) */}
      <input
        type="text"
        value={topic}
        maxLength={60}
        disabled={isLoading}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isLoading) handleGenerate();
        }}
        placeholder="Chủ đề bạn muốn hỏi (vd: tình cảm, chuyển việc, sức khỏe…)"
        aria-label="Chủ đề luận giải (tự do)"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "11px 14px",
          marginBottom: "10px",
          borderRadius: "14px",
          border: "1px solid rgba(192,132,252,0.3)",
          background: "rgba(255,255,255,0.05)",
          color: "#f5e9ff",
          fontSize: "0.92rem",
          outline: "none",
        }}
      />

      {/* GỢI Ý NHANH */}
      <div
        role="group"
        aria-label="Gợi ý chủ đề"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        {TOPIC_SUGGESTIONS.map((label) => {
          const active =
            label.toLowerCase() === topic.trim().toLowerCase();
          return (
            <button
              key={label}
              type="button"
              disabled={isLoading}
              aria-label={`Gợi ý ${label}`}
              onClick={() => applySuggestion(label)}
              style={{
                padding: "6px 12px",
                borderRadius: "999px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: isLoading ? "default" : "pointer",
                transition: "0.2s ease",
                color: active ? "#fff" : "rgba(233,213,255,0.72)",
                border: active
                  ? "1px solid rgba(192,132,252,0.7)"
                  : "1px solid rgba(255,255,255,0.12)",
                background: active
                  ? "rgba(168,85,247,0.3)"
                  : "rgba(255,255,255,0.04)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading}
        style={{
          width: "100%",
          padding: "13px",
          borderRadius: "16px",
          border: "1px solid rgba(192,132,252,0.45)",
          background: isLoading
            ? "rgba(168,85,247,0.12)"
            : "rgba(168,85,247,0.22)",
          color: "#f5e9ff",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: isLoading ? "wait" : "pointer",
          transition: "0.25s ease",
        }}
        onMouseEnter={(e) => {
          if (isLoading) return;
          e.currentTarget.style.background = "rgba(168,85,247,0.32)";
          e.currentTarget.style.boxShadow = "0 0 22px rgba(168,85,247,0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isLoading
            ? "rgba(168,85,247,0.12)"
            : "rgba(168,85,247,0.22)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {isLoading ? "Đang luận giải…" : "✨ Luận giải sâu hôm nay"}
      </button>

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          style={{
            marginTop: "14px",
            padding: "10px 12px",
            borderRadius: "12px",
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "#fecaca",
            fontSize: "0.85rem",
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {/* RESULT */}
      {result?.deep_reading && (
        <div style={{ marginTop: "16px" }}>
          {result.cached && (
            <div
              style={{
                display: "inline-block",
                marginBottom: "10px",
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#86efac",
                background: "rgba(34,197,94,0.14)",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              Đã lưu luận giải hôm nay
            </div>
          )}
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(192,132,252,0.16)",
              color: "#ede9fe",
              fontSize: "0.92rem",
              lineHeight: 1.6,
            }}
            className="deep-reading-markdown"
          >
            <ReactMarkdown>{result.deep_reading}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
