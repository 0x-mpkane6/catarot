import styles from "./LoginForm.module.css";

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { login } from "../../services/authService";
import GoogleLoginButton from "./GoogleLoginButton";

import toast from "react-hot-toast";

export default function LoginForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);

  // Lưu phiên đăng nhập (dùng chung cho đăng nhập thường và đăng nhập Google).
  const persistSession = (res) => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");

    const store = rememberMe ? localStorage : sessionStorage;
    store.setItem("token", res.token);
    store.setItem("user", JSON.stringify(res.user));
  };

  const handleLogin = async () => {
    if (loading) return; // chan double-submit khi nhan Enter lien tuc luc request dang bay (nut da disabled nhung phim Enter thi khong)
    try {
      setLoading(true);

      // validate empty fields
      if (!email || !password) {
        toast.error("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      const res = await login(email.trim(), password.trim());

      persistSession(res);

      toast.success("Chào mừng trở lại!");

      navigate("/home");
    } catch {
      toast.error("Email hoặc mật khẩu không đúng");
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập Google thành công → lưu phiên rồi chuyển vào trang chính.
  const handleGoogleSuccess = (res) => {
    persistSession(res);
    toast.success("Chào mừng trở lại!");
    navigate("/home");
  };

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>Chào mừng trở lại!</h2>

        {/* GOOGLE */}
        <GoogleLoginButton
          text="signin_with"
          fallbackClassName={styles.googleBtn}
          fallbackLabel="Đăng nhập với Google"
          onSuccess={handleGoogleSuccess}
        />

        <div className={styles.divider}>Hoặc</div>

        {/* EMAIL */}
        <input
          className={styles.input}
          placeholder="Email của bạn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleLogin();
            }
          }}
        />

        {/* ROW */}
        <div className={styles.row}>
          <label className={styles.remember}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Ghi nhớ đăng nhập
          </label>

          <span
            className={styles.link}
            onClick={() => navigate("/forgot-password")}
          >
            Quên mật khẩu?
          </span>
        </div>

        {/* LOGIN */}
        <button
          className={styles.loginBtn}
          onClick={handleLogin}
          disabled={loading}
          style={{
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        {/* SIGN UP */}
        <p className={styles.signup}>
          Chưa có tài khoản?{" "}
          <span className={styles.link} onClick={() => navigate("/signin")}>
            Đăng ký
          </span>
        </p>
      </div>
    </div>
  );
}
