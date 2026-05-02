import { useEffect, useRef } from "react";
import styles from "./Sidebar.module.css";

import logo from "../../assets/images/chatpage/short-logo.png";
import book from "../../assets/images/chatpage/short-reading.png";

export default function Sidebar({ collapsed, setCollapsed }) {
  const sidebarRef = useRef();

  // click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setCollapsed(true);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setCollapsed]);

  // ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setCollapsed(true);
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [setCollapsed]);

  return (
    <div
      ref={sidebarRef}
      className={`${styles.sidebar} ${
        collapsed ? styles.collapsed : ""
      }`}
    >
      {/* LOGO */}
      <button
        className={styles.logoBtn}
        onClick={() => collapsed && setCollapsed(false)}
      >
        <img src={logo} className={styles.logo} />
      </button>

      {!collapsed ? (
        <>
          <button className={styles.newBtn}>New reading</button>
          <p className={styles.history}>History</p>
        </>
      ) : (
        <button className={styles.iconBtn}>
          <img src={book} />
        </button>
      )}
    </div>
  );
}