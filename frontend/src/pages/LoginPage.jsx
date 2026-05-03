import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, Sparkles } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login(email, password);
    navigate("/reading");
  };

  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow"><Sparkles size={15} /> Dấu ấn linh hồn</p>
        <h1>Trở lại căn phòng Oracle</h1>
        <form onSubmit={handleSubmit}>
          <label className="input-label" htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          <label className="input-label" htmlFor="password">Mật khẩu</label>
          <input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          {error && <p className="mystic-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={loading}>
            <LogIn size={17} />
            <span>{loading ? "Đang mở cửa..." : "Đăng nhập"}</span>
          </button>
        </form>
        <p className="auth-switch">Chưa có dấu ấn? <Link to="/register">Tạo tài khoản</Link></p>
      </div>
    </section>
  );
}
