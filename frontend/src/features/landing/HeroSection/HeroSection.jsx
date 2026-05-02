import styles from "./HeroSection.module.css";

import bg from "../../../assets/images/landing/background.jpg";
import logo from "../../../assets/images/landing/logo.png";
import { useNavigate } from "react-router-dom";

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className={styles.hero}>
      <img src={bg} className={styles.bg} />

      <div className={styles.content}>
        <div className={styles.card}>
          <img src={logo} className={styles.logo} />
          <p className={styles.desc}>
            Khám phá bản thân thông qua sự dẫn dắt của AI.
          </p>
          <button
            className={styles.btn}
            onClick={() => navigate("/login")}
          >
            Khám phá ngay
          </button>
        </div>
      </div>
    </section>
  );
}