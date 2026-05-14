import styles from "./ChatHeader.module.css";

export default function ChatHeader() {
  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Welcome back!</h1>
      <h2 className={styles.subtitle}>
        Khám phá bản thân thông qua sự dẫn dắt của AI.
      </h2>
    </div>
  );
}