import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, UserPlus } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    await register(email, password);
    navigate("/reading");
  };

  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow"><Sparkles size={15} /> Khắc tên vào tinh tú</p>
        <h1>Tạo tài khoản Oracle Chamber</h1>
        <form onSubmit={handleSubmit}>
          <label className="input-label" htmlFor="register-email">Email</label>
          <input id="register-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          <label className="input-label" htmlFor="register-password">Mật khẩu</label>
          <input id="register-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} required />
          {error && <p className="mystic-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={loading}>
            <UserPlus size={17} />
            <span>{loading ? "Đang tạo dấu ấn..." : "Tạo tài khoản"}</span>
          </button>
        </form>
        <p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </div>
    </section>
  );
}
