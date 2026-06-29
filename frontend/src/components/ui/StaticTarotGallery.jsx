import { useEffect, useRef } from "react";
import { motion as Motion } from "framer-motion";

import "./StaticTarotGallery.css";

import useIsMobile from "../../hooks/useIsMobile";
import useReducedMotion from "../../hooks/useReducedMotion";
import { tapHaptic } from "../../lib/haptics";

import dailyTarot from "../../assets/images/homepage/the-princess.png";
import timeCapsule from "../../assets/images/homepage/the-emperor.png";
import tarotReading from "../../assets/images/homepage/the-magician.png";
import duoReading from "../../assets/images/homepage/the-lovers.png";
import communityRoom from "../../assets/images/homepage/the-world.png";

const TAROT_CARDS = [
  {
    image: dailyTarot,
    text: "Tarot Hằng Ngày",
    mode: "daily",
  },
  {
    image: timeCapsule,
    text: "Kho Tầm Nhìn",
    mode: "visions",
  },
  {
    image: tarotReading,
    text: "Trải Bài",
    mode: "reading",
  },
  {
    image: duoReading,
    text: "Trải Bài Đôi",
    mode: "duo",
  },
  {
    image: communityRoom,
    text: "Phòng Cộng Đồng",
    mode: "community",
  },
];

// Mô tả ngắn từng chế độ — giúp người mới hiểu mỗi lá để làm gì (chỉ hiện ở mobile).
const SUBTITLES = {
  daily: "Một lá dẫn lối cho hôm nay",
  visions: "Kho ký ức & tầm nhìn của bạn",
  reading: "Hỏi một câu — luận giải chuyên sâu",
  duo: "Trải bài kết nối hai người",
  community: "Chia sẻ cùng cộng đồng",
};

const getCardClassName = (
  index
) => {
  if (index === 2) {
    return "static-tarot-card is-center";
  }

  if (index < 2) {
    return "static-tarot-card is-left";
  }

  return "static-tarot-card is-right";
};

// Nhịp hiện dần dùng chung cho lưới mobile (transform/opacity → mượt, nhẹ).
const CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/**
 * Bố cục MOBILE riêng: 1 lá chính "Trải Bài" nổi bật (hero rộng) + lưới 2 cột cho
 * 4 chế độ còn lại. Hiện dần so le khi vào, lò xo nhún khi chạm + rung nhẹ.
 * KHÔNG dùng lại markup desktop nên không ảnh hưởng layout quạt bài trên web.
 */
function MobileGallery({ onCardClick }) {
  const reduced = useReducedMotion();
  const hero = TAROT_CARDS.find((card) => card.mode === "reading");
  const rest = TAROT_CARDS.filter((card) => card.mode !== "reading");

  const handleTap = (card) => {
    tapHaptic();
    onCardClick?.(card);
  };

  return (
    <Motion.div
      className="mobile-gallery"
      variants={CONTAINER_VARIANTS}
      initial={reduced ? false : "hidden"}
      animate="show"
    >
      <Motion.button
        type="button"
        variants={ITEM_VARIANTS}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        className="mg-hero"
        onClick={() => handleTap(hero)}
      >
        <div className="mg-hero__art">
          <img src={hero.image} alt={hero.text} />
        </div>

        <div className="mg-hero__body">
          <span className="mg-hero__eyebrow">✦ Bắt đầu</span>
          <span className="mg-hero__title">{hero.text}</span>
          <span className="mg-hero__sub">{SUBTITLES[hero.mode]}</span>
        </div>

        <span className="mg-hero__shine" aria-hidden="true" />
      </Motion.button>

      <Motion.div className="mg-grid" variants={CONTAINER_VARIANTS}>
        {rest.map((card) => (
          <Motion.button
            key={card.text}
            type="button"
            variants={ITEM_VARIANTS}
            whileTap={reduced ? undefined : { scale: 0.94 }}
            className="mg-cell"
            onClick={() => handleTap(card)}
          >
            <div className="mg-cell__art">
              <img src={card.image} alt={card.text} />
            </div>

            <span className="mg-cell__title">{card.text}</span>
            <span className="mg-cell__sub">{SUBTITLES[card.mode]}</span>
          </Motion.button>
        ))}
      </Motion.div>
    </Motion.div>
  );
}

/**
 * Bố cục DESKTOP: quạt 5 lá cũ + 2 nâng cấp wow:
 *  - Deal-in: lá xòe hiện dần so le khi vào (CSS, trên image-shell nên không đụng
 *    transform quạt của nút).
 *  - Tilt 3D theo con trỏ: nghiêng CẢ hàng (set --tilt-x/--tilt-y qua JS) → cả bộ
 *    bài "phản ứng" với tay. Chuẩn hoá theo tâm hàng nên đúng kể cả khi trang bị
 *    --home-page-scale. Tắt khi Giảm chuyển động / màn cảm ứng.
 */
function DesktopGallery({ onCardClick }) {
  const reduced = useReducedMotion();
  const rowRef = useRef(null);

  useEffect(() => {
    if (reduced) return undefined;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return undefined;
    }

    const row = rowRef.current;
    if (!row) return undefined;

    let raf = 0;
    const clamp = (v) => Math.max(-1, Math.min(1, v));

    const onMove = (e) => {
      const r = row.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        row.style.setProperty("--tilt-x", `${clamp(nx) * 7}deg`);
        row.style.setProperty("--tilt-y", `${clamp(ny) * -5}deg`);
      });
    };

    const reset = () => {
      cancelAnimationFrame(raf);
      row.style.setProperty("--tilt-x", "0deg");
      row.style.setProperty("--tilt-y", "0deg");
    };

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", reset);
    };
  }, [reduced]);

  return (
    <div className="static-tarot-gallery">
      <div className="static-tarot-gallery__aura" />

      <div className="static-tarot-gallery__row" ref={rowRef}>
        {TAROT_CARDS.map(
          (card, index) => (
            <button
              key={card.text}
              type="button"
              className={getCardClassName(
                index
              )}
              onClick={() =>
                onCardClick?.(card)
              }
            >
              <div className="static-tarot-card__image-shell">
                <img
                  src={card.image}
                  alt={card.text}
                  className="static-tarot-card__image"
                />
              </div>

              <div className="static-tarot-card__title">
                {card.text}
              </div>
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function StaticTarotGallery({
  onCardClick,
}) {
  const isMobile = useIsMobile();

  // Mobile: lưới riêng (MobileGallery). Desktop: quạt bài + deal-in + tilt 3D.
  if (isMobile) {
    return <MobileGallery onCardClick={onCardClick} />;
  }

  return <DesktopGallery onCardClick={onCardClick} />;
}
