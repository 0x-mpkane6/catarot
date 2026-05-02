import { useState } from "react";
import styles from "./ChatInput.module.css";

import uploadIcon from "../../assets/images/chatpage/upload.png";
import micIcon from "../../assets/images/chatpage/voice-icon.png";

export default function ChatInput({ onSend }) {
  const [mode, setMode] = useState("Select mode");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const options = ["Tarot", "Horoscope", "Natal Chart"];

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputBox}>
        <input
          type="text"
          placeholder="Enter your question"
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className={styles.bottom}>
          {/* SELECT MODE */}
          <div className={styles.dropdown}>
            <button
              className={styles.modeBtn}
              onClick={() => setOpen(!open)}
            >
              {mode !== "Select mode" && (
                <span
                  className={styles.clearBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode("Select mode");
                  }}
                >
                  ✕
                </span>
              )}
              {mode}
            </button>

            {open && (
              <div className={styles.menu}>
                {options.map((item) => (
                  <div
                    key={item}
                    className={styles.option}
                    onClick={() => {
                      setMode(item);
                      setOpen(false);
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div className={styles.actions}>
            <button className={styles.iconBtn}>
              <img src={uploadIcon} />
            </button>

            <button className={styles.iconBtn}>
              <img src={micIcon} />
            </button>

            <button
              className={styles.sendBtn}
              onClick={() => onSend(text, mode)}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}