import SigninForm from "../features/login/SigninForm.jsx";
import styles from "./LoginPage.module.css";

export default function SigninPage() {
  return (
    <div className={styles.page}>
      <div className={styles.overlay}></div>

      <div className={styles.wrapper}>
        <SigninForm />
      </div>
    </div>
  );
}