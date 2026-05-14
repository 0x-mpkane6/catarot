import styles from "./FeaturesSection.module.css";

import tarotImg from "../../../assets/images/landing/Tarot.png";
import horoscopeImg from "../../../assets/images/landing/Horoscope.png";
import natalImg from "../../../assets/images/landing/NatalChart.png";

import { useState, useEffect } from "react";

export default function FeaturesSection() {
  const [selected, setSelected] = useState(null);

  const features = [
    {
      name: "Tarot",
      image: tarotImg,
      description:
        "Tarot giúp bạn khám phá bản thân, dự đoán xu hướng tương lai và đưa ra lời khuyên thông qua các lá bài.",
    },
    {
      name: "Horoscope",
      image: horoscopeImg,
      description:
        "Horoscope phân tích cung hoàng đạo dựa trên ngày sinh, giúp hiểu tính cách và các mối quan hệ.",
    },
    {
      name: "Natal Chart",
      image: natalImg,
      description:
        "Natal Chart là bản đồ sao cá nhân, phản ánh vị trí các hành tinh khi bạn sinh ra.",
    },
  ];

  // ✅ ESC để đóng
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setSelected(null);
      }
    };

    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // ✅ disable scroll khi mở modal
  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "auto";
  }, [selected]);

  return (
    <section className={styles.section}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Features</h2>

        <div className={styles.container}>
          {features.map((item, index) => (
            <button
              key={index}
              className={styles.card}
              onClick={() => setSelected(item)}
            >
              <img src={item.image} alt={item.name} />
              <p>{item.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {selected && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelected(null)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selected.image}
              alt={selected.name}
              className={styles.modalImg}
            />

            <div className={styles.modalContent}>
              <h3>{selected.name}</h3>
              <p>{selected.description}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}