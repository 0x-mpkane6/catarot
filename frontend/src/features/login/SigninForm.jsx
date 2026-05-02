import styles from "./LoginForm.module.css";
import googleIcon from "../../assets/images/auth/google.webp";

import { useNavigate } from "react-router-dom";

export default function SigninForm() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>Let's get started</h2>

        {/* GOOGLE */}
        <button className={styles.googleBtn}>
          <img src={googleIcon} />
          Google
        </button>

        <div className={styles.divider}>Or</div>

        {/* INPUT */}
        <input className={styles.input} placeholder="Enter email" />
        <input className={styles.input} placeholder="Enter username" />
        <input type="password" className={styles.input} placeholder="Enter password" />
        <input type="password" className={styles.input} placeholder="Confirm password" />

        {/* SIGNUP */}
        <button className={styles.loginBtn}>Sign up</button>

        {/* BACK */}
        <span
          className={styles.link}
          onClick={() => navigate("/login")}
          style={{ marginTop: "10px" }}
        >
          Back
        </span>
      </div>
    </div>
  );
}