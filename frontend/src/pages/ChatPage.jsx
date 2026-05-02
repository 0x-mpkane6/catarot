import { useState } from "react";
import styles from "./ChatPage.module.css";

import Sidebar from "../components/ui/Sidebar";
import ChatHeader from "../components/ui/ChatHeader";
import ChatBox from "../components/ui/ChatBox";
import ChatInput from "../components/ui/ChatInput";
import TarotBoard from "../components/ui/TarotBoard";

import tarotData from "../../backend/data/raw/tarot_json/tarot-images.json";
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
      ? `/assets/tarot/${found.img}`
      : "/fallback.jpg";
  };

  const handleSend = (text, selectedMode) => {
    setQuestion(text);
    setMode(selectedMode);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
    ]);

    if (selectedMode === "Tarot" && text.trim()) {
      setStep("selecting");
    }
  };

  const handleReveal = async () => {
    try {
      setStep("revealed");

      const res = await getTarotReading({
        question,
      });

      // 🔥 attach image vào card
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
      console.error(err);
    }
  };

  return (
    <div className={styles.page}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={`${styles.main} ${
          collapsed ? styles.mainCollapsed : styles.mainExpanded
        }`}
      >
        {/* IDLE */}
        {step === "idle" && (
          <>
            <ChatHeader />
            <ChatBox messages={messages} />
          </>
        )}

        {/* SELECT */}
        {step === "selecting" && (
          <TarotBoard onSelect={handleReveal} />
        )}

        {/* RESULT */}
        {step === "revealed" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 300px",
              height: "100%",
            }}
          >
            {/* CHAT */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: "650px" }}>
                <ChatBox messages={messages} />
              </div>
            </div>

            {/* TAROT */}
            <div>
              <TarotBoard revealed cards={cards} />

              <div style={{ marginTop: 20, color: "white" }}>
                {cards.map((c, i) => (
                  <div key={i}>
                    🔮 <b>{c.name}</b>{" "}
                    ({c.orientation === "upright" ? "↑" : "↓"})
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}