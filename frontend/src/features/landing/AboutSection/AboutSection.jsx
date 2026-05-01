import styles from "./AboutSection.module.css";

export default function AboutSection() {
  return (
    <section id="about" className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>About</h2>
        <p className={styles.text}>
          Đây là phần giới thiệu tổng quan về AI-Cana.
        </p>
      </div>
    </section>
  );
}