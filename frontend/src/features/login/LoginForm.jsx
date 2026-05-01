import styles from "./LoginForm.module.css";
import googleIcon from "../../assets/images/auth/google.webp";

import { useNavigate } from "react-router-dom";

export default function LoginForm() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>Welcome back!</h2>

        {/* GOOGLE */}
        <button className={styles.googleBtn}>
          <img src={googleIcon} />
          Google
        </button>

        <div className={styles.divider}>Or</div>

        {/* INPUT */}
        <input
          className={styles.input}
          placeholder="username or email"
        />

        <input
          type="password"
          className={styles.input}
          placeholder="password"
        />

        {/* ROW */}
        <div className={styles.row}>
          <label className={styles.remember}>
            <input type="checkbox" />
            Remember me
          </label>

          <span
            className={styles.link}
            onClick={() => navigate("/forgot-password")}
          >
            Forgot Password?
          </span>
        </div>

        {/* LOGIN */}
        <button className={styles.loginBtn}>Log in</button>

        {/* SIGN UP */}
        <p className={styles.signup}>
          Don’t have an account?{" "}
          <span
            className={styles.link}
            onClick={() => navigate("/signup")}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}