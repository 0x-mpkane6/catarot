// src/components/layout/Navbar.jsx

import styles from "./Navbar.module.css";
import logo from "../../assets/images/landing/logo.png";

export default function Navbar({ variant = "dark" }) {
  return (
    <nav className={`${styles.navbar} ${styles[variant]}`}>
      <div className={styles.container}>

        {/* logo bên trái */}
        <div className={styles.logo}>
          <img src={logo} alt="AI-Cana" />
        </div>

        {/* menu bên phải */}
        <div className={styles.menu}>
          <a>About</a>
          <a>How it works</a>
          <a>Features</a>
          <button className={styles.btn}>Log in / Sign in</button>
        </div>

      </div>
    </nav>
  );
}