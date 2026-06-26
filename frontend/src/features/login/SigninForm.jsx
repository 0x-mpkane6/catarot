import styles from "./LoginForm.module.css";
import { useNavigate } from "react-router-dom";

import { useState } from "react";
import { register } from "../../services/authService";
import GoogleLoginButton from "./GoogleLoginButton";
import { useAppSettings } from "../../context/AppSettingsContext";
import { isValidPassword } from "./passwordValidation";

import toast from "react-hot-toast";

export default function SigninForm() {
  const navigate = useNavigate();
  const { t } = useAppSettings();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (loading) return; // chan double-submit khi nhan Enter lien tuc luc request dang bay
    try {
      setLoading(true);

      // validate
      if (!email || !password || !confirmPassword) {
        toast.error(t("signup_missing"));
        return;
      }

      if (!isValidPassword(password)) {
        toast.error(t("auth_password_invalid"));
        return;
      }

      if (password !== confirmPassword) {
        toast.error(t("signup_password_mismatch"));
        return;
      }

      if (username.trim() && username.trim().length < 3) {
        toast.error(t("signup_username_short"));
        return;
      }

      // API — gửi cả username (tùy chọn) lên backend
      await register(email.trim(), password.trim(), username.trim());

      toast.success(t("signup_success"));

      // redirect
      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      console.error(err);

      toast.error(err.response?.data?.detail || t("signup_failed"));
    } finally {
      setLoading(false);
    }
  };

  // Đăng ký/đăng nhập bằng Google → đã có phiên đăng nhập, vào thẳng trang chính.
  const handleGoogleSuccess = (res) => {
    // Dọn sạch phiên cũ ở CẢ hai storage trước khi ghi phiên mới. Nếu không, token cũ
    // còn trong localStorage (vd lần trước đăng nhập có tích "Ghi nhớ đăng nhập") sẽ được
    // getStoredToken ưu tiên hơn token mới ở sessionStorage → request chạy dưới danh tính cũ.
    ["token", "access_token", "user"].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    // Đăng nhập Google KHÔNG có ô "ghi nhớ" → luôn lưu localStorage để phiên còn sau khi
    // đóng/mở lại app (TWA/PWA: sessionStorage mất khi thoát app → đăng xuất mỗi lần mở lại).
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    toast.success(t("signup_welcome"));
    navigate("/home", { replace: true });
  };

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>{t("signup_title")}</h2>

        {/* GOOGLE */}
        <GoogleLoginButton
          text="signup_with"
          fallbackClassName={styles.googleBtn}
          fallbackLabel={t("signup_google")}
          onSuccess={handleGoogleSuccess}
        />

        <div className={styles.divider}>{t("common_or")}</div>

        {/* EMAIL */}
        <input
          className={styles.input}
          placeholder={t("signup_email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* USERNAME */}
        <input
          className={styles.input}
          placeholder={t("signup_username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        {/* PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder={t("signup_password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* CONFIRM PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder={t("signup_confirm_password")}
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
          {loading ? t("signup_submitting") : t("signup_submit")}
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
          {t("common_back")}
        </span>
      </div>
    </div>
  );
}
