import {
  Copy,
  Check,
  Volume2,
} from "lucide-react";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

import useIsMobile from "../../hooks/useIsMobile";
import SpeechPlaybackMessage from "./SpeechPlaybackMessage";

function stripReferenceSection(content) {
  const text = String(content ?? "");
  return text
    .replace(
      /\n{0,2}(?:#{1,6}\s*)?(?:Tư liệu tham khảo|Tài liệu tham khảo|Tham khảo|References?)\s*\n[\s\S]*$/i,
      ""
    )
    .trim();
}

export default function ChatConversation({
  messages = [],
}) {

  const isMobile = useIsMobile();

  const [copiedIndex,
    setCopiedIndex] =
    useState(null);
  const [replaySignalByIndex,
    setReplaySignalByIndex] =
    useState({});

  const handleCopy = async (
    text,
    index
  ) => {
    // navigator.clipboard la undefined khi chay o ngu canh khong an toan (HTTP non-localhost)
    // -> tranh unhandled rejection lam nut copy "im lang" khong phan hoi.
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch {
      /* clipboard khong kha dung: bo qua, khong lam vo UI */
    }
  };

  const handleReplay = (
    index
  ) => {
    setReplaySignalByIndex(
      (prev) => ({
        ...prev,
        [index]:
          (prev[index] || 0) + 1,
      })
    );
  };

  return (

    <div
      style={{
        width: "100%",

        display: "flex",

        flexDirection: "column",

        gap: "22px",

        paddingBottom: isMobile ? "120px" : "180px",
      }}
    >

      {messages.map(
        (message, index) => {

          const isUser =
            message.role === "user";
          const messageContent = isUser
            ? String(message.content ?? "")
            : stripReferenceSection(
                message.content
              );
          const speechKey =
            message.speechKey ||
            `assistant-${index}-${messageContent.length}`;

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

                  maxWidth: isMobile ? "88%" : "720px",

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

                  fontSize: isMobile ? "1.06rem" : "1.14rem",

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
                  className={
                    isUser ? "chat-bubble user" : "chat-bubble assistant"
                  }
                  style={{
                    // User message giữ plain text (đơn giản, ko cần markdown).
                    // Assistant: render markdown để bold/list/heading hiển thị đẹp.
                    whiteSpace: isUser ? "pre-wrap" : "normal",
                  }}
                >
                  {isUser ? (
                    messageContent
                  ) : (
                    !isUser ? (
                      <SpeechPlaybackMessage
                        text={messageContent}
                        autoPlay={message.speechPlaybackEnabled}
                        speechKey={speechKey}
                        replaySignal={replaySignalByIndex[index] || 0}
                      />
                    ) : (
                      <ReactMarkdown
                        components={{
                          a: (props) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                        }}
                      >
                        {String(message.content ?? "")}
                      </ReactMarkdown>
                    )
                  )}
                </div>

                {/* copy button */}
                <button
                  onClick={() =>
                    handleCopy(
                      messageContent,
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

                    // Mobile không hover được nên hiện mờ sẵn nút copy.
                    opacity: isMobile ? 0.6 : 0,

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

                {!isUser ? (
                  <button
                    onClick={() =>
                      handleReplay(index)
                    }
                    style={{
                      position: "absolute",

                      top: "12px",

                      right: "52px",

                      width: "32px",

                      height: "32px",

                      borderRadius: "50%",

                      border: "none",

                      background:
                        "rgba(255,255,255,0.08)",

                      color: "#fff",

                      opacity: isMobile ? 0.6 : 0,

                      cursor: "pointer",

                      transition:
                        "0.25s ease",

                      display: "flex",

                      alignItems: "center",

                      justifyContent:
                        "center",
                    }}
                    className="copy-btn"
                    title="Replay speech"
                  >
                    <Volume2 size={16} />
                  </button>
                ) : null}

              </div>

            </div>
          );
        }
      )}

    </div>
  );
}
