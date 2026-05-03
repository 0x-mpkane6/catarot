import { Link, NavLink, useNavigate } from "react-router-dom";
import { BookOpen, Flame, LogOut, Menu, Moon, Sparkles, UserRound, Volume2, Waves } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { usePreferencesStore } from "../../stores/preferencesStore";

const navItems = [
  { to: "/reading", label: "Đọc bài", icon: Sparkles },
  { to: "/daily-card", label: "Lá hôm nay", icon: Flame },
  { to: "/dream-journal", label: "Giấc mơ", icon: Moon },
  { to: "/duo", label: "Duo", icon: Waves },
  { to: "/community", label: "Cộng đồng", icon: BookOpen },
  { to: "/profile", label: "Hồ sơ", icon: UserRound },
];

export default function TopNav() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);
  const toggleReduceMotion = usePreferencesStore((state) => state.toggleReduceMotion);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="top-nav">
      <Link className="brand-mark" to="/">
        <span className="brand-sigil">OC</span>
        <span>
          <strong>Oracle Chamber</strong>
          <small>Ask the cards. Let the Oracle guide you.</small>
        </span>
      </Link>

      <nav className="nav-links" aria-label="Điều hướng chính">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="nav-actions">
        <button className="icon-button" type="button" onClick={toggleReduceMotion} title="Giảm chuyển động">
          {reduceMotion ? <Menu size={18} /> : <Volume2 size={18} />}
        </button>
        {user ? (
          <button className="ghost-button" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Rời phòng</span>
          </button>
        ) : (
          <Link className="ghost-button" to="/login">
            <UserRound size={16} />
            <span>Đăng nhập</span>
          </Link>
        )}
      </div>
    </header>
  );
}
