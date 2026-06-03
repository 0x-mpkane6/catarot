import styles from "./LoginForm.module.css";
import { useNavigate } from "react-router-dom";

import { useState } from "react";
import { requestPasswordReset } from "../../services/authService";

import toast from "react-hot-toast";

export default function ForgotPasswordForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (loading) return; // chan double-submit khi nhan Enter lien tuc luc request dang bay
    try {
      setLoading(true);

      if (!email.trim()) {
        toast.error("Vui lòng nhập email của bạn");
        return;
      }

      await requestPasswordReset(email.trim());

      // Phản hồi giống nhau dù email tồn tại hay không (chống dò email).
      toast.success("Nếu email tồn tại, hướng dẫn đặt lại đã được gửi.");
    } catch {
      toast.error("Đã có lỗi xảy ra. Vui lòng thử lại.");
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
        <h2 className={styles.title}>Quên mật khẩu</h2>

        <p style={{ fontSize: "12px", opacity: 0.7, textAlign: "center" }}>
          Đừng lo, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn
        </p>

        {/* INPUT */}
        <input
          className={styles.input}
          placeholder="Nhập email"
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
          {loading ? "Đang gửi..." : "Gửi"}
        </button>

        {/* BACK */}
        <span
          className={styles.link}
          onClick={() => navigate("/login")}
          style={{ marginTop: "20px" }}
        >
          Quay lại
        </span>
      </div>
    </div>
  );
}
