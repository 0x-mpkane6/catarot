import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { BookOpen, Flame, Moon, Radio, Sparkles, Stars } from "lucide-react";
import CardSpread from "../components/tarot/CardSpread";

const previewCards = [
  { name: "The Star", orientation: "upright", position: "past" },
  { name: "The High Priestess", orientation: "upright", position: "present" },
  { name: "The Sun", orientation: "upright", position: "future" },
];

const heroBadges = [
  { icon: <Stars size={14} />, label: "Tarot AI · 78 lá" },
  { icon: <Radio size={14} />, label: "Oracle live" },
  { icon: <Moon size={14} />, label: "Daily ritual" },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <Motion.section
        className="hero-copy"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <Motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <Sparkles size={16} /> Oracle Chamber
        </Motion.p>

        <h1>Hỏi các lá bài. Để Nữ tiên tri dẫn lối.</h1>

        <p className="hero-subtitle">
          Văn bản, giọng nói hoặc ảnh lá bài thật — câu hỏi của ngươi sẽ bước vào một căn phòng huyền bí
          nơi ánh trăng, pha lê và Tarot cùng trả lời.
        </p>

        <Motion.div
          className="hero-badges"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
          }}
        >
          {heroBadges.map((badge) => (
            <Motion.span
              key={badge.label}
              className="hero-badge"
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
            >
              {badge.icon}
              {badge.label}
            </Motion.span>
          ))}
        </Motion.div>

        <Motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
        >
          <Link className="primary-button cta-pulse" to="/reading">
            <Sparkles size={18} />
            <span>Bắt đầu đọc bài</span>
          </Link>
          <Link className="secondary-magic-button" to="/daily-card">
            <Flame size={18} />
            <span>Rút lá hôm nay</span>
          </Link>
          <Link className="secondary-magic-button" to="/dream-journal">
            <Moon size={18} />
            <span>Nhật ký mơ</span>
          </Link>
        </Motion.div>

        <Motion.p
          className="hero-foot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          <span className="live-dot" /> Mụ tiên tri đang trong căn phòng — phản ứng theo từng cử chỉ của ngươi.
        </Motion.p>
      </Motion.section>

      <Motion.section
        className="landing-preview"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.7 }}
      >
        <Motion.div
          className="preview-orbit"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="orbit-label">
            <Stars size={14} /> Trải bài demo
          </div>
          <CardSpread cards={previewCards} revealed />
        </Motion.div>

        <div className="preview-stack">
          <Motion.article
            className="glass-tile"
            whileHover={{ y: -6, rotate: -1 }}
            transition={{ duration: 0.4 }}
          >
            <Flame size={20} />
            <strong>Streak 7 ngày</strong>
            <span>Ngọn lửa vàng tím đang cháy sáng.</span>
          </Motion.article>
          <Motion.article
            className="glass-tile"
            whileHover={{ y: -6, rotate: 1 }}
            transition={{ duration: 0.4 }}
          >
            <BookOpen size={20} />
            <strong>Oracle Report</strong>
            <span>Những chủ đề lặp lại sẽ tự hiện hình.</span>
          </Motion.article>
        </div>
      </Motion.section>
    </div>
  );
}
