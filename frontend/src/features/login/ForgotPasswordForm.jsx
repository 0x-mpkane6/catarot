import styles from "./LoginForm.module.css";
import { useNavigate } from "react-router-dom";

import { useState } from "react";
import { requestPasswordReset } from "../../services/authService";
import { useAppSettings } from "../../context/AppSettingsContext";

import toast from "react-hot-toast";

export default function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { t } = useAppSettings();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (loading) return; // chan double-submit khi nhan Enter lien tuc luc request dang bay
    try {
      setLoading(true);

      if (!email.trim()) {
        toast.error(t("forgot_missing"));
        return;
      }

      await requestPasswordReset(email.trim());

      // Phản hồi giống nhau dù email tồn tại hay không (chống dò email).
      toast.success(t("forgot_success"));
    } catch {
      toast.error(t("forgot_failed"));
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
        <h2 className={styles.title}>{t("forgot_title")}</h2>

        <p style={{ fontSize: "12px", opacity: 0.7, textAlign: "center" }}>
          {t("forgot_desc")}
        </p>

        {/* INPUT */}
        <input
          className={styles.input}
          placeholder={t("forgot_email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
        />

        {/* BUTTON */}
        <button
          className={styles.loginBtn}
          onClick={handleSend}
          disabled={loading}
          style={{
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? t("forgot_submitting") : t("forgot_submit")}
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
