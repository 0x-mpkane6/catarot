import styles from "./FeaturesSection.module.css";

export default function FeaturesSection() {
  return (
    <section id="features" className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Features</h2>

        <div className={styles.grid}>
          <div className={styles.card}>Feature 1</div>
          <div className={styles.card}>Feature 2</div>
          <div className={styles.card}>Feature 3</div>
        </div>
      </div>
    </section>
  );
}