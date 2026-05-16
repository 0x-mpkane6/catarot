import { Upload, ArrowBigUp, AudioLines } from "lucide-react";

export default function ChatBox() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "900px",

        padding: "14px 18px",

        borderRadius: "28px",

        background:
          "rgba(18, 10, 35, 0.88)",

        border:
          "1px solid rgba(192, 132, 252, 0.14)",

        backdropFilter: "blur(20px)",

        boxShadow:
          "0 0 35px rgba(168, 85, 247, 0.08)",

        display: "flex",
        alignItems: "center",
        gap: "14px",

        boxSizing: "border-box",
      }}
    >

      {/* upload */}
      <button style={iconButtonStyle}>
        <Upload size={22} />
      </button>

      {/* input */}
      <input
        type="text"
        placeholder="Ask the cards something..."

        style={{
          flex: 1,

          background: "transparent",

          border: "none",
          outline: "none",

          color: "#ffffff",

          fontSize: "1rem",
          fontWeight: 500,

          fontFamily: "inherit",

          padding: "8px 4px",
        }}
      />

      {/* voice */}
      <button style={iconButtonStyle}>
        <AudioLines size={22} />
      </button>

      {/* send */}
      <button
        style={{
          width: "46px",
          height: "46px",

          borderRadius: "50%",

          border: "none",

          background:
            "linear-gradient(135deg, #c084fc, #e879f9)",

          color: "#fff",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          cursor: "pointer",

          transition: "0.25s ease",

          boxShadow:
            "0 0 20px rgba(192,132,252,0.35)",
        }}
      >
        <ArrowBigUp size={24} />
      </button>
    </div>
  );
}

const iconButtonStyle = {
  width: "42px",
  height: "42px",

  borderRadius: "50%",

  border: "1px solid rgba(255,255,255,0.08)",

  background:
    "rgba(255,255,255,0.04)",

  color: "#d8c8ff",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  cursor: "pointer",

  transition: "0.25s ease",
};