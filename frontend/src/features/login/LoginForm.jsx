import styles from "./LoginForm.module.css";

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { login } from "../../services/authService";
import GoogleLoginButton from "./GoogleLoginButton";
import { useAppSettings } from "../../context/AppSettingsContext";

import toast from "react-hot-toast";

export default function LoginForm() {
  const navigate = useNavigate();
  const { t } = useAppSettings();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);

  // Lưu phiên đăng nhập (dùng chung cho đăng nhập thường và đăng nhập Google).
  // persistent=true → ép localStorage (phiên còn sau khi đóng/mở lại app). Đăng nhập Google
  // không có ô "ghi nhớ" nên luôn ép bền: TWA/PWA mất sessionStorage khi thoát app → nếu để
  // sessionStorage thì mỗi lần mở lại app sẽ bị đăng xuất.
  const persistSession = (res, persistent = rememberMe) => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");

    const store = persistent ? localStorage : sessionStorage;
    store.setItem("token", res.token);
    store.setItem("user", JSON.stringify(res.user));
  };

  const handleLogin = async () => {
    if (loading) return; // chan double-submit khi nhan Enter lien tuc luc request dang bay (nut da disabled nhung phim Enter thi khong)
    try {
      setLoading(true);

      // validate empty fields
      if (!email || !password) {
        toast.error(t("login_missing"));
        return;
      }

      const res = await login(email.trim(), password.trim());

      persistSession(res);

      toast.success(t("login_success"));

      // replace: thay /login bằng /home trong lịch sử → khi ở gallery bấm Back sẽ về landing,
      // KHÔNG quay lại trang đăng nhập (người đã đăng nhập không nên thấy lại form login).
      navigate("/home", { replace: true });
    } catch {
      toast.error(t("login_invalid"));
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập Google thành công → lưu phiên rồi chuyển vào trang chính.
  const handleGoogleSuccess = (res) => {
    persistSession(res, true); // ép localStorage để không bị đăng xuất khi mở lại app
    toast.success(t("login_success"));
    navigate("/home", { replace: true });
  };

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>{t("login_title")}</h2>

        {/* GOOGLE */}
        <GoogleLoginButton
          text="signin_with"
          fallbackClassName={styles.googleBtn}
          fallbackLabel={t("login_google")}
          onSuccess={handleGoogleSuccess}
        />

        <div className={styles.divider}>{t("common_or")}</div>

        {/* EMAIL */}
        <input
          className={styles.input}
          placeholder={t("login_email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder={t("login_password")}
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
            {t("login_remember")}
          </label>

          <span
            className={styles.link}
            onClick={() => navigate("/forgot-password")}
          >
            {t("login_forgot")}
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
          {loading ? t("login_submitting") : t("login_submit")}
        </button>

        {/* SIGN UP */}
        <p className={styles.signup}>
          {t("login_no_account")}{" "}
          <span className={styles.link} onClick={() => navigate("/signin")}>
            {t("login_signup")}
          </span>
        </p>
      </div>
    </div>
  );
}
