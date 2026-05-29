import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function MarkdownOverlay({
  isOpen,
  title,
  content = "",
  onClose,
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background:
            "rgba(0,0,0,0.36)",
          backdropFilter:
            "blur(10px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents:
            isOpen ? "auto" : "none",
          transition: "0.3s ease",
          zIndex: 140,
        }}
      />

      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: isOpen
            ? "translate(-50%, -50%) scale(1)"
            : "translate(-50%, -48%) scale(0.98)",
          width: "min(920px, 90vw)",
          maxHeight: "min(82vh, 860px)",
          borderRadius: "28px",
          border:
            "1px solid rgba(168,85,247,0.16)",
          background:
            "linear-gradient(180deg, rgba(15,10,30,0.96), rgba(8,5,18,0.98))",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.45)",
          backdropFilter:
            "blur(24px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents:
            isOpen ? "auto" : "none",
          transition:
            "all 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 150,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "24px 28px 18px",
            borderBottom:
              "1px solid rgba(168,85,247,0.12)",
          }}
        >
          <div
            style={{
              color: "#fff",
              fontSize: "1.45rem",
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              border:
                "1px solid rgba(255,255,255,0.08)",
              background:
                "rgba(255,255,255,0.04)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: "24px 28px 30px",
            overflowY: "auto",
          }}
        >
          <div className="markdown-overlay__content">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </>
  );
}
