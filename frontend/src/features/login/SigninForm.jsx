import styles from "./LoginForm.module.css";
import { useNavigate } from "react-router-dom";

import { useState } from "react";
import { register } from "../../services/authService";
import GoogleLoginButton from "./GoogleLoginButton";

import toast from "react-hot-toast";

export default function SigninForm() {
  const navigate = useNavigate();

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
        toast.error("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      if (password.length < 6) {
        toast.error("Mật khẩu phải có ít nhất 6 ký tự");
        return;
      }

      if (password !== confirmPassword) {
        toast.error("Mật khẩu xác nhận không khớp");
        return;
      }

      if (username.trim() && username.trim().length < 3) {
        toast.error("Tên đăng nhập phải có ít nhất 3 ký tự");
        return;
      }

      // API — gửi cả username (tùy chọn) lên backend
      await register(email.trim(), password.trim(), username.trim());

      toast.success("Tạo tài khoản thành công!");

      // redirect
      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      console.error(err);

      toast.error(err.response?.data?.detail || "Đăng ký thất bại");
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
    sessionStorage.setItem("token", res.token);
    sessionStorage.setItem("user", JSON.stringify(res.user));
    toast.success("Chào mừng bạn!");
    navigate("/home");
  };

  return (
    <div className={styles.container}>
      {/* LEFT */}
      <div className={styles.left}></div>

      {/* RIGHT */}
      <div className={styles.right}>
        <h2 className={styles.title}>Bắt đầu nào</h2>

        {/* GOOGLE */}
        <GoogleLoginButton
          text="signup_with"
          fallbackClassName={styles.googleBtn}
          fallbackLabel="Đăng ký với Google"
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

        {/* USERNAME */}
        <input
          className={styles.input}
          placeholder="Tên đăng nhập"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        {/* PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* CONFIRM PASSWORD */}
        <input
          type="password"
          className={styles.input}
          placeholder="Xác nhận mật khẩu"
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
          {loading ? "Đang tạo..." : "Đăng ký"}
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
          Quay lại
        </span>
      </div>
    </div>
  );
}
