import { useState } from "react";
import styles from "./ChatPage.module.css";

import Sidebar from "../components/ui/Sidebar";
import ChatHeader from "../components/ui/ChatHeader";
import ChatBox from "../components/ui/ChatBox";
import ChatInput from "../components/ui/ChatInput";
import TarotBoard from "../components/ui/TarotBoard";

import tarotData from "../assets/tarot/tarot_json/tarot-images.json";
import { getTarotReading } from "../services/tarotService";

export default function ChatPage() {
  const [collapsed, setCollapsed] = useState(false);

  const [mode, setMode] = useState(null);
  const [question, setQuestion] = useState("");
  const [step, setStep] = useState("idle");
  const [cards, setCards] = useState([]);

  const [messages, setMessages] = useState([]);

  // 🔥 map name → image
  const getCardImage = (name) => {
    const found = tarotData.cards.find((c) => c.name === name);

    return found
      ? new URL(
          `../assets/tarot/tarot_json/cards/${found.img}`,
          import.meta.url
        ).href
      : "";
  };

  // =========================
  // 🔥 HANDLE SEND (FIX CHÍNH)
  // =========================
  const handleSend = async ({ text, mode, images = [], audio = null }) => {
    setQuestion(text);
    setMode(mode);

    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // ❌ chưa chọn mode
    if (!mode || mode === "Select mode") return;

    // =========================
    // 🔮 TAROT MODE
    // =========================
    if (mode === "Tarot") {
      // 🔥 CASE 1: có IMAGE → gọi API luôn
      if (images.length > 0) {
        await callTarotAPI(text, images, null);
      }

      // 🔥 CASE 2: AUDIO hoặc TEXT → phải chọn bài
      else {
        setStep("selecting");
      }
    }
  };

  // =========================
  // 🔥 CALL API
  // =========================
  const callTarotAPI = async (question, images = [], audio = null) => {
    try {
      setStep("revealed");

      const res = await getTarotReading({
        question,
        images,
        audio,
      });

      const mappedCards = res.cards.map((c) => ({
        ...c,
        image: getCardImage(c.name),
      }));

      setCards(mappedCards);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          type: "tarot",
          content: {
            cards: mappedCards,
            answer: res.final_answer,
            warnings: res.warnings,
          },
        },
      ]);
    } catch (err) {
      console.error("API ERROR:", err);
    }
  };

  // =========================
  // 🔥 SAU KHI CHỌN 3 LÁ
  // =========================
  const handleReveal = async () => {
    await callTarotAPI(question);
  };

  return (
    <div className={styles.page}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={`${styles.main} ${
          collapsed ? styles.mainCollapsed : styles.mainExpanded
        }`}
      >
        {/* ===== IDLE ===== */}
        {step === "idle" && (
          <div className={styles.chatOnly}>
            <ChatHeader />

            <div className={styles.chatCenter}>
              <ChatBox messages={messages} />
            </div>

            <ChatInput onSend={handleSend} />
          </div>
        )}

        {/* ===== SELECT ===== */}
        {step === "selecting" && (
          <TarotBoard onSelect={handleReveal} />
        )}

        {/* ===== RESULT ===== */}
        {step === "revealed" && (
          <div className={styles.resultLayout}>
            {/* 💬 CHAT */}
            <div className={styles.chatPanel}>
              <ChatBox messages={messages} />
              <ChatInput onSend={handleSend} />
            </div>

            {/* 🔮 TAROT */}
            <div className={styles.rightPanel}>
              <div className={styles.tarotList}>
                {cards.map((c, i) => (
                  <div key={i} className={styles.tarotItem}>
                    <div className={styles.imgWrapper}>
                      <img
                        src={c.image}
                        style={{
                          transform:
                            c.orientation === "reversed"
                              ? "rotate(180deg)"
                              : "none",
                        }}
                      />
                    </div>

                    <div className={styles.tarotText}>
                      <b>{c.name}</b>
                      <div>
                        {c.orientation === "upright"
                          ? "↑ Upright"
                          : "↓ Reversed"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}