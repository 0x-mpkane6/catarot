import styles from "./LoginForm.module.css";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useState } from "react";
import { resetPassword } from "../../services/authService";
import { useAppSettings } from "../../context/AppSettingsContext";
import { isValidPassword } from "./passwordValidation";

import toast from "react-hot-toast";

export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Token lấy từ link trong email: /reset-password?token=...
  const token = searchParams.get("token") || "";
  const { t } = useAppSettings();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (loading) return; // chặn double-submit khi nhấn Enter liên tục lúc request đang bay

    if (!token) {
      toast.error(t("reset_no_token"));
      return;
    }

    if (!password || !confirmPassword) {
      toast.error(t("reset_missing"));
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

    try {
      setLoading(true);
      await resetPassword(token, password.trim());
      toast.success(t("reset_success"));
      // replace: không để người dùng Back lại trang đặt lại với token đã dùng.
      navigate("/login", { replace: true });
    } catch {
      // Backend trả 400 khi token sai/hết hạn.
      toast.error(t("reset_failed"));
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
        <h2 className={styles.title}>{t("reset_title")}</h2>

        <p style={{ fontSize: "12px", opacity: 0.7, textAlign: "center" }}>
          {t("reset_desc")}
        </p>

        {!token && (
          <p
            style={{
              fontSize: "12px",
              color: "#fca5a5",
              textAlign: "center",
            }}
          >
            {t("reset_no_token")}
          </p>
        )}

        {/* NEW PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder={t("reset_new_password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* CONFIRM */}
        <input
          type="password"
          className={styles.input}
          placeholder={t("signup_confirm_password")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleReset();
            }
          }}
        />

        {/* SUBMIT */}
        <button
          className={styles.loginBtn}
          onClick={handleReset}
          disabled={loading}
          style={{
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? t("reset_submitting") : t("reset_submit")}
        </button>

        {/* BACK */}
        <span
          className={styles.link}
          onClick={() => navigate("/login")}
          style={{ marginTop: "20px" }}
        >
          {t("common_back")}
        </span>
      </div>
    </div>
  );
}
