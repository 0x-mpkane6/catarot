import { useEffect, useState } from "react";
import { Check, Copy, Volume2, X } from "lucide-react";
import toast from "react-hot-toast";

import { getDeepReading } from "../../services/dailyService";
import useIsMobile from "../../hooks/useIsMobile";
import SpeechPlaybackMessage from "./SpeechPlaybackMessage";

const TOPIC_SUGGESTIONS = [
  "Tổng quan",
  "Công việc",
  "Tình cảm",
  "Học tập",
  "Tài chính",
  "Sức khỏe",
  "Các mối quan hệ",
];

const stripReferenceSection = (content) =>
  String(content ?? "")
    .replace(
      /\n{0,2}(?:#{1,6}\s*)?(?:Tư liệu tham khảo|Tài liệu tham khảo|Tham khảo|References?)\s*\n[\s\S]*$/i,
      ""
    )
    .trim();

export default function DeepReadingPanel({
  card = null,
  isOpen = false,
  onClose = () => {},
}) {
  const isMobile = useIsMobile();
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [replaySignal, setReplaySignal] = useState(0);
  // Chủ đề ĐÃ DÙNG để sinh kết quả đang hiển thị (khác `topic` ở ô input đang gõ) — để header
  // không lệch: gõ chủ đề mới mà chưa Generate thì header vẫn khớp luận giải đang hiện.
  const [generatedTopic, setGeneratedTopic] = useState("");

  const cardKey =
    card?.id ??
    card?.draw_date ??
    card?.card_name ??
    null;

  useEffect(() => {
    setResult(null);
    setError("");
    setTopic("");
    setCopied(false);
    setReplaySignal(0);
    setGeneratedTopic("");
  }, [cardKey]);

  if (!card || !card.card_name || !isOpen) {
    return null;
  }

  const applySuggestion = (label) => {
    setTopic(label);
    setResult(null);
    setError("");
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getDeepReading({ topic });
      setResult(data);
      setGeneratedTopic(topic.trim() || "Tổng quan");
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

  const deepReadingText = stripReferenceSection(
    result?.deep_reading
  );
  const activeTopicLabel = topic.trim() || "Tổng quan";
  // Header hiển thị chủ đề KHỚP với luận giải đang hiện: có kết quả thì dùng chủ đề lúc sinh;
  // chưa có thì theo ô input đang gõ.
  const headerTopicLabel = result ? generatedTopic || "Tổng quan" : activeTopicLabel;
  const speechKey =
    cardKey && deepReadingText
      ? `daily-deep-${cardKey}-${deepReadingText.length}`
      : "";

  const handleCopy = async () => {
    if (!deepReadingText) return;
    try {
      await navigator.clipboard.writeText(deepReadingText);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
      toast.success("Đã sao chép luận giải sâu");
    } catch {
      toast.error("Không sao chép được luận giải sâu");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(8, 5, 18, 0.48)",
        backdropFilter: "blur(10px)",
        display: "flex",
        justifyContent: isMobile ? "center" : "flex-start",
        alignItems: isMobile ? "flex-end" : "stretch",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: isMobile ? "100vw" : "460px",
          maxWidth: "100%",
          height: isMobile ? "82vh" : "100vh",
          marginLeft: isMobile ? 0 : "40px",
          padding: "24px",
          boxSizing: "border-box",
          overflowY: "auto",
          borderRadius: isMobile ? "28px 28px 0 0" : "0 28px 28px 0",
          background:
            "linear-gradient(180deg, rgba(24,16,42,0.97), rgba(12,8,24,0.98))",
          border: "1px solid rgba(192,132,252,0.2)",
          boxShadow: "0 20px 70px rgba(120,70,200,0.25)",
          color: "#e9d5ff",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            width: "40px",
            height: "40px",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#fff",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} />
        </button>

        <div style={{ marginBottom: "16px", paddingRight: "54px" }}>
          <div
            style={{
              fontSize: "1.08rem",
              fontWeight: 700,
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
            {headerTopicLabel}
          </div>
        </div>

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
          aria-label="Chủ đề luận giải"
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
                onClick={() => applySuggestion(label)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: isLoading ? "default" : "pointer",
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
          }}
        >
          {isLoading ? "Đang luận giải…" : "✨ Luận giải sâu hôm nay"}
        </button>

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

        {deepReadingText && (
          <div style={{ marginTop: "16px" }}>
            {result?.cached && (
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
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setReplaySignal((prev) => prev + 1)
                }
                style={iconButtonStyle}
                title="Đọc luận giải sâu"
              >
                <Volume2 size={18} />
              </button>

              <button
                type="button"
                onClick={handleCopy}
                style={iconButtonStyle}
                title="Sao chép luận giải sâu"
              >
                {copied ? (
                  <Check size={18} />
                ) : (
                  <Copy size={18} />
                )}
              </button>
            </div>

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
              <SpeechPlaybackMessage
                text={deepReadingText}
                autoPlay
                speechKey={speechKey}
                replaySignal={replaySignal}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const iconButtonStyle = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.05)",
  color: "#f3d0ff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
