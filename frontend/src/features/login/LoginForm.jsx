import styles from "./LoginForm.module.css";
import googleIcon from "../../assets/images/auth/google.webp";

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { login } from "../../services/authService";

export default function LoginForm() {
  const navigate = useNavigate();

  // 🔥 thêm state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔥 thêm handle login
  const handleLogin = async () => {
    try {
      const res = await login(email, password);

      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));

      // 👉 chuyển trang
      navigate("/chat");
    } catch (err) {
      alert(err.message);
    }
  };

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className={styles.input}
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        <button
          className={styles.loginBtn}
          onClick={handleLogin} // 🔥 thêm dòng này
        >
          Log in
        </button>

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