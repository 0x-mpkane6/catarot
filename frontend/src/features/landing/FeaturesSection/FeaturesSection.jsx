import styles from "./FeaturesSection.module.css";

import tarotImg from "../../../assets/images/landing/Tarot.png";
import horoscopeImg from "../../../assets/images/landing/Horoscope.png";
import natalImg from "../../../assets/images/landing/NatalChart.png";

export default function FeaturesSection() {
  const features = [
    {
      name: "Tarot",
      image: tarotImg,
      onClick: () => console.log("Tarot clicked"),
    },
    {
      name: "Horoscope",
      image: horoscopeImg,
      onClick: () => console.log("Horoscope clicked"),
    },
    {
      name: "Natal Chart",
      image: natalImg,
      onClick: () => console.log("Natal clicked"),
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        {features.map((item, index) => (
          <button
            key={index}
            className={styles.card}
            onClick={item.onClick}
          >
            <img src={item.image} alt={item.name} />
            <p>{item.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
}