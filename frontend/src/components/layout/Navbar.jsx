import styles from "./Navbar.module.css";
import logo from "../../assets/images/landing/logo.png";
import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar({ variant = "dark" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const scrollTo = (id) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: "smooth",
        });
      }, 100);
    } else {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
      });
    }
  };

  return (
    <nav className={`${styles.navbar} ${styles[variant]}`}>
      <div className={styles.container}>

        {/* logo */}
        <div className={styles.logo}>
          <img src={logo} alt="AI-Cana" />
        </div>

        {/* menu */}
        <div className={styles.menu}>
          <a onClick={() => scrollTo("about")}>About</a>
          <a onClick={() => scrollTo("how")}>How it works</a>
          <a onClick={() => scrollTo("features")}>Features</a>

          <button
            className={styles.btn}
            onClick={() => navigate("/login")}
          >
            Log in / Sign in
          </button>
        </div>

      </div>
    </nav>
  );
}