import styles from "./HowItWorksSection.module.css";

export default function HowItWorksSection() {
  return (
    <section id="how" className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>How it works</h2>

        <div className={styles.steps}>
          <div className={styles.step}>Step 1</div>
          <div className={styles.step}>Step 2</div>
          <div className={styles.step}>Step 3</div>
        </div>
      </div>
    </section>
  );
}