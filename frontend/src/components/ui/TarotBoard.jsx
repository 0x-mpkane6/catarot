import { useState, useEffect } from "react";
import styles from "./TarotBoard.module.css";
import back from "../../assets/images/chatpage/tarot-backside.png";

export default function TarotBoard({ onSelect, revealed, cards = [] }) {
  const [picked, setPicked] = useState([]);

  const TOTAL = 36;

  // 🔥 reset khi bắt đầu lượt mới
  useEffect(() => {
    if (!revealed) {
      setPicked([]);
    }
  }, [revealed]);

  const handlePick = (index) => {
    if (picked.includes(index) || picked.length >= 3) return;

    const newPicked = [...picked, index];
    setPicked(newPicked);

    if (newPicked.length === 3) {
      onSelect && onSelect(newPicked);
    }
  };

  const allIndexes =
    picked.length === 3
      ? picked
      : Array.from({ length: TOTAL }, (_, i) => i);

  const half = Math.ceil(allIndexes.length / 2);
  const row1 = allIndexes.slice(0, half);
  const row2 = allIndexes.slice(half);

  return (
    <div
      className={`${styles.board} ${
        picked.length === 3 || revealed ? styles.centerMode : ""
      }`}
    >
      {/* 🔮 CHƯA LẬT */}
      {!revealed && picked.length !== 3 ? (
        <>
          <div className={styles.row}>
            {row1.map((i) => (
              <div
                key={i}
                className={`${styles.card} ${
                  picked.includes(i) ? styles.picked : ""
                }`}
                onClick={() => handlePick(i)}
              >
                <img src={back} />
              </div>
            ))}
          </div>

          <div className={styles.row}>
            {row2.map((i) => (
              <div
                key={i}
                className={`${styles.card} ${
                  picked.includes(i) ? styles.picked : ""
                }`}
                onClick={() => handlePick(i)}
              >
                <img src={back} />
              </div>
            ))}
          </div>
        </>
      ) : (
        /* 🔥 ĐÃ LẬT */
        cards.map((card, idx) => (
          <div key={idx} className={styles.card}>
            <img
              src={card.image}
              style={{
                transform:
                  card.orientation === "reversed"
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                transition: "transform 0.4s ease", // 🔥 smooth hơn
              }}
            />
          </div>
        ))
      )}
    </div>
  );
}