import styles from "./LoginForm.module.css";
import { useNavigate } from "react-router-dom";
import googleIcon from "../../assets/images/auth/google.webp";

import { useState } from "react";
import { register } from "../../services/authService";

import toast from "react-hot-toast";

export default function SigninForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    try {
      setLoading(true);

      // validate
      if (!email || !password || !confirmPassword) {
        toast.error("Please fill all fields");
        return;
      }

      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }

      if (password !== confirmPassword) {
        toast.error("Password does not match");
        return;
      }

<<<<<<< Updated upstream
      if (username.trim() && username.trim().length < 3) {
        toast.error("Username must be at least 3 characters");
        return;
      }
=======
      // API
      const res = await register(
        email.trim(),
        password.trim(),
        username.trim() || null
      );
>>>>>>> Stashed changes

      // API — gửi cả username (tùy chọn) lên backend
      await register(
        email.trim(),
        password.trim(),
        username.trim()
      );

      toast.success("Account created!");

      // redirect
      setTimeout(() => {
        navigate("/login");
      }, 1200);

    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.detail ||
        "Signup failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>
          Let's get started
        </h2>

        {/* GOOGLE */}
        <button className={styles.googleBtn}>
          <img src={googleIcon} alt="google" />
          Google
        </button>

        <div className={styles.divider}>Or</div>

        {/* EMAIL */}
        <input
          className={styles.input}
          placeholder="Example@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* USERNAME */}
        <input
          className={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        {/* PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* CONFIRM PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSignup();
            }
          }}
        />

        {/* SIGNUP */}
        <button
          className={styles.loginBtn}
          onClick={handleSignup}
          disabled={loading}
          style={{
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating..." : "Sign up"}
        </button>

        {/* BACK */}
        <span
          className={styles.link}
          onClick={() => navigate("/login")}
          style={{
            marginTop: "10px",
            textAlign: "center",
          }}
        >
          Back
        </span>
      </div>
    </div>
  );
}

