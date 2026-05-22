import {
  Copy,
  Check,
} from "lucide-react";

import { useState } from "react";

export default function ChatConversation({
  messages = [],
}) {

  const [copiedIndex,
    setCopiedIndex] =
    useState(null);

  const handleCopy = async (
    text,
    index
  ) => {

    await navigator.clipboard
      .writeText(text);

    setCopiedIndex(index);

    setTimeout(() => {
      setCopiedIndex(null);
    }, 1500);
  };

  return (

    <div
      style={{
        width: "100%",

        display: "flex",

        flexDirection: "column",

        gap: "22px",

        paddingBottom: "180px",
      }}
    >

      {messages.map(
        (message, index) => {

          const isUser =
            message.role === "user";

          return (

            <div
              key={index}

              style={{
                display: "flex",

                justifyContent:
                  isUser
                    ? "flex-end"
                    : "flex-start",
              }}
            >

              <div
                style={{
                  position: "relative",

                  maxWidth: "720px",

                  padding:
                    "18px 22px",

                  borderRadius:
                    "22px",

                  background:
                    isUser
                      ? `
                        linear-gradient(
                          135deg,
                          #a855f7,
                          #d946ef
                        )
                      `
                      : `
                        rgba(
                          20,
                          10,
                          35,
                          0.92
                        )
                      `,

                  border:
                    isUser
                      ? "none"
                      : `
                        1px solid
                        rgba(
                          255,
                          255,
                          255,
                          0.08
                        )
                      `,

                  color: "#fff",

                  lineHeight: 1.7,

                  fontSize: "1rem",

                  boxShadow:
                    isUser
                      ? `
                        0 0 30px
                        rgba(
                          217,
                          70,
                          239,
                          0.24
                        )
                      `
                      : `
                        0 0 24px
                        rgba(
                          0,
                          0,
                          0,
                          0.24
                        )
                      `,
                }}
              >

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {message.content}
                </div>

                {/* copy button */}
                <button
                  onClick={() =>
                    handleCopy(
                      message.content,
                      index
                    )
                  }

                  style={{
                    position: "absolute",

                    top: "12px",

                    right: "12px",

                    width: "32px",

                    height: "32px",

                    borderRadius: "50%",

                    border: "none",

                    background:
                      "rgba(255,255,255,0.08)",

                    color: "#fff",

                    opacity: 0,

                    cursor: "pointer",

                    transition:
                      "0.25s ease",

                    display: "flex",

                    alignItems: "center",

                    justifyContent:
                      "center",
                  }}

                  className="copy-btn"
                >
                  {copiedIndex ===
                  index ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>

              </div>

            </div>
          );
        }
      )}

    </div>
  );
}