import { useEffect, useState } from "react";
import styles from "./ScrollTopBtn.module.css";

export default function ScrollTopBtn() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      className={styles.btn}
      onClick={() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    >
      ↑
    </button>
  );
}