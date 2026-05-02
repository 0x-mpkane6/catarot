export default function ChatBox({ messages }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        justifyContent:
          messages.length <= 2 ? "center" : "flex-start",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "650px",
          maxHeight: "70vh",
          overflowY: "auto",
          padding: "20px",
          paddingBottom: "160px",
          color: "white",
        }}
      >
        {messages.map((msg, i) => {
          // USER
          if (msg.role === "user") {
            return (
              <div key={i} style={{ textAlign: "right", marginBottom: 16 }}>
                <div
                  style={{
                    display: "inline-block",
                    background: "#7C3AED",
                    padding: "10px 14px",
                    borderRadius: 16,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          }

          // TAROT
          if (msg.type === "tarot") {
            return (
              <div key={i} style={{ marginBottom: 24 }}>
                {/* answer */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    padding: "16px",
                    borderRadius: "16px",
                    lineHeight: 1.6,
                    whiteSpace: "pre-line",
                  }}
                >
                  {msg.content.answer}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}