import styles from "./LoginForm.module.css";
import { useNavigate } from "react-router-dom";

export default function ForgotPasswordForm() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>Forgot password</h2>

        <p style={{ fontSize: "12px", opacity: 0.7, textAlign: "center" }}>
        No worries, we’ll send you reset instruction
        </p>

        {/* INPUT */}
        <input
          className={styles.input}
          placeholder="Enter email"
        />

        {/* BUTTON */}
        <button className={styles.loginBtn}>Send</button>

        {/* BACK */}
        <span
          className={styles.link}
          onClick={() => navigate("/login")}
          style={{ marginTop: "20px" }}
        >
          Back
        </span>
      </div>
    </div>
  );
}