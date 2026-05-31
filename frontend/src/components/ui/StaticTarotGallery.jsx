import "./StaticTarotGallery.css";

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

export default function StaticTarotGallery({
  onCardClick,
}) {
  return (
    <div className="static-tarot-gallery">
      <div className="static-tarot-gallery__aura" />

      <div className="static-tarot-gallery__row">
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
