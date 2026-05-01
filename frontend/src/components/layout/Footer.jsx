import styles from "./Footer.module.css";

import logo from "../../assets/images/landing/logo.png";
import githubIcon from "../../assets/images/landing/github.png";
import mailIcon from "../../assets/images/landing/mail.png";
import facebookIcon from "../../assets/images/landing/facebook.png";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>

        {/* LEFT */}
        <div className={styles.left}>
        <h3 className={styles.title}>About us</h3>

        <div className={styles.item}>
            <img src={mailIcon} alt="mail" />
            <span className={styles.text}>
            [24520758, 24520131]@gm.uit.edu.vn
            </span>
        </div>

        <div className={styles.item}>
            <img src={githubIcon} alt="github" />
            <span className={styles.text}>
            0x-mpkane6 - TrangTuanAnh
            </span>
        </div>

        <div className={styles.item}>
            <img src={facebookIcon} alt="facebook" />
            <span className={styles.text}>
            Phúc Khang - Trang Anh
            </span>
        </div>
        </div>

        {/* CENTER */}
        <div className={styles.center}>
        <img src={logo} className={styles.logo} />

        <p className={styles.text}>
            Khám phá bản thân thông qua sự dẫn dắt của AI.
        </p>

        <div className={styles.links}>
            <a>About</a>
            <a>How it works</a>
            <a>Features</a>
        </div>

        <p className={styles.copy}>© 2026 AI-Cana</p>
        </div>

        {/* RIGHT */}
        <div className={styles.right}>
          <h3 className={styles.titleRight}>Feedback</h3>

          <p className={styles.textRight}>
            Ý kiến của bạn giúp AI-Cana hoàn thiện hơn!
          </p>

          <div className={styles.inputGroup}>
            <input
              type="text"
              placeholder="enter your feedback"
              className={styles.input}
            />
            <button className={styles.btn}>Send</button>
          </div>
        </div>

      </div>
    </footer>
  );
}