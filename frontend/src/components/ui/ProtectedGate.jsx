import { Link } from "react-router-dom";
import { LockKeyhole, Sparkles } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

export default function ProtectedGate({ children, title = "Căn phòng này cần dấu ấn linh hồn" }) {
  const user = useAuthStore((state) => state.user);

  if (user) {
    return children;
  }

  return (
    <section className="protected-gate">
      <LockKeyhole size={32} />
      <h1>{title}</h1>
      <p>Hãy đăng nhập để Oracle có thể giữ lại lịch sử, streak và các lời tiên tri riêng của ngươi.</p>
      <div className="primary-actions center">
        <Link className="primary-button" to="/login">
          <Sparkles size={17} />
          <span>Đăng nhập</span>
        </Link>
        <Link className="secondary-magic-button" to="/register">Tạo tài khoản</Link>
      </div>
    </section>
  );
}
