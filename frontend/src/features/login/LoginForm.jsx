import styles from "./LoginForm.module.css";
import googleIcon from "../../assets/images/auth/google.webp";

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { login } from "../../services/authService";

import toast from "react-hot-toast";

export default function LoginForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

const handleLogin = async () => {
  try {

    // validate empty fields
    if (!email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    const res = await login(
      email.trim(),
      password.trim()
    );

    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));

    toast.success("Welcome back!");

    navigate("/chat");

  } catch (err) {
    toast.error("Invalid email or password");
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
          placeholder="Example@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className={styles.input}
          placeholder="Password"
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
          onClick={handleLogin} 
        >
          Log in
        </button>

        {/* SIGN UP */}
        <p className={styles.signup}>
          Don’t have an account?{" "}
          <span
            className={styles.link}
            onClick={() => navigate("/signin")}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}