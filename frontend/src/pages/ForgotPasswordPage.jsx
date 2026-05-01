import ForgotPasswordForm from "../features/login/ForgotPasswordForm";
import styles from "./LoginPage.module.css";

export default function ForgotPasswordPage() {
  return (
    <div className={styles.page}>
      <div className={styles.overlay}></div>

      <div className={styles.wrapper}>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}