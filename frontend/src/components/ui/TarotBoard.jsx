import { useState } from "react";
import styles from "./TarotBoard.module.css";
import back from "../../assets/images/chatpage/tarot-backside.png";
import { FakeAPI } from "../../services/FakeAPI";

export default function TarotBoard({ question }) {
  const [picked, setPicked] = useState([]);
  const [cards, setCards] = useState([]);

  const TOTAL = 36; // số lá hiển thị (chia 2 hàng)

  const handlePick = async (index) => {
    if (picked.includes(index) || picked.length >= 3) return;

    const newPicked = [...picked, index];
    setPicked(newPicked);

    if (newPicked.length === 3) {
      const res = await FakeAPI.drawTarot(newPicked);
      setCards(res);
    }
  };

  // 👉 chia 2 hàng
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
        picked.length === 3 ? styles.centerMode : ""
      }`}
    >
      {/* ===== NORMAL MODE ===== */}
      {picked.length !== 3 ? (
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
                <img src={back} alt="card" />
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
                <img src={back} alt="card" />
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ===== CENTER MODE ===== */
        cards.map((card, idx) => (
          <div key={card.id} className={styles.card}>
            <img src={card.image} alt={card.name} />
          </div>
        ))
      )}
    </div>
  );
}