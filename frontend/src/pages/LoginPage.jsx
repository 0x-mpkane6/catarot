import LoginForm from "../features/login/LoginForm.jsx";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.overlay}></div>

      <div className={styles.wrapper}>
        <LoginForm />
      </div>
    </div>
  );
}