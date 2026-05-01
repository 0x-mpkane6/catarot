import { useState } from "react";
import styles from "./ChatPage.module.css";

import Sidebar from "../components/ui/Sidebar";
import ChatHeader from "../components/ui/ChatHeader";
import ChatBox from "../components/ui/ChatBox";
import ChatInput from "../components/ui/ChatInput";
import TarotBoard from "../components/ui/TarotBoard";

import { FakeAPI } from "../services/FakeAPI";

export default function ChatPage() {
  const [collapsed, setCollapsed] = useState(false);

  // 🔥 thêm state tarot
  const [mode, setMode] = useState(null);
  const [question, setQuestion] = useState("");
  const [step, setStep] = useState("idle"); // idle | selecting | revealed
  const [cards, setCards] = useState([]);

  // 👉 khi bấm send
  const handleSend = (text, selectedMode) => {
    setQuestion(text);
    setMode(selectedMode);

    if (selectedMode === "Tarot" && text.trim()) {
      setStep("selecting");
    }
  };

  // 👉 sau khi chọn 3 lá
  const handleReveal = async (indexes) => {
    const res = await FakeAPI.drawTarot(indexes);
    setCards(res);
    setStep("revealed");
  };

  return (
    <div className={styles.page}>
      {/* SIDEBAR */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* MAIN */}
      <div
        className={`${styles.main} ${
          collapsed ? styles.mainCollapsed : styles.mainExpanded
        }`}
      >
        {/* 🧠 SWITCH UI */}
        {step === "idle" && (
          <>
            <ChatHeader />
            <ChatBox />
          </>
        )}

        {step === "selecting" && (
          <TarotBoard onSelect={handleReveal} />
        )}

        {step === "revealed" && (
          <TarotBoard revealed cards={cards} />
        )}

        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}