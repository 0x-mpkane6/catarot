import { useState } from "react";

import useIsMobile from "../../hooks/useIsMobile";
import tarotBack from "../../assets/images/homepage/tarot-back-des-2.png";
import { getCardImageByName } from "../../lib/cardImages";

/**
 * Reveals the drawn cards in a side rail: each card is dealt in from below,
 * flips from its back to its face (staggered), then breathes gently. Click a
 * card to open a full preview.
 */
export default function TarotResultPanel({ cards = [] }) {
  const [previewCard, setPreviewCard] = useState(null);
  const isMobile = useIsMobile();

  const count = cards.length;
  // Mobile: lá nhỏ lại (~120px cao) để 3 lá nằm ngang vừa màn hình.
  const cardHeight = isMobile
    ? 120
    : count <= 1
      ? 300
      : count <= 3
        ? 212
        : 158;
  const cardWidth = Math.round(cardHeight * 0.6);
  const panelWidth = cardWidth + 54;

  return (
    <>
      <style>
        {`
          @keyframes trp-deal {
            from { opacity: 0; transform: translateY(48px) scale(0.84); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes trp-flip {
            from { transform: rotateY(180deg); }
            to   { transform: rotateY(0deg); }
          }
          @keyframes trp-float {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-7px); }
          }
          @keyframes trp-slide {
            from { opacity: 0; transform: translateX(60px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          .trp-card {
            display: flex;
            justify-content: center;
            cursor: pointer;
            opacity: 1;
            animation: trp-deal 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .trp-persp {
            perspective: 1000px;
            filter: drop-shadow(0 14px 26px rgba(0, 0, 0, 0.5));
            animation: trp-float 4.6s ease-in-out infinite;
            transition: filter 0.3s ease;
          }
          .trp-card:hover .trp-persp {
            filter: drop-shadow(0 0 30px rgba(217, 70, 239, 0.6));
          }
          .trp-flip {
            position: relative;
            transform-style: preserve-3d;
            transform: rotateY(0deg);
            animation: trp-flip 0.95s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .trp-face {
            position: absolute;
            inset: 0;
            border-radius: 16px;
            overflow: hidden;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            border: 1px solid rgba(255, 255, 255, 0.16);
            box-shadow: 0 0 30px rgba(192, 132, 252, 0.22),
              inset 0 0 22px rgba(0, 0, 0, 0.35);
          }
          .trp-face img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .trp-face.front { transform: rotateY(0deg); }
          .trp-face.back  { transform: rotateY(180deg); }
          .trp-badge {
            position: absolute;
            top: 8px;
            right: 8px;
            z-index: 4;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 0.6rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            color: #fde68a;
            background: rgba(20, 10, 30, 0.7);
            border: 1px solid rgba(253, 230, 138, 0.4);
            backdrop-filter: blur(4px);
          }
          @media (prefers-reduced-motion: reduce) {
            .trp-card, .trp-persp, .trp-flip { animation: none !important; }
          }
        `}
      </style>

      {/* side rail */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          right: "44px",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: count <= 1 ? "center" : "space-evenly",
          alignItems: "center",
          gap: "10px",
          height: "82vh",
          width: `${panelWidth}px`,
          zIndex: 40,

          // Mobile: rail nằm ngang trên đầu, cuộn ngang nếu tràn.
          ...(isMobile
            ? {
                position: "sticky",
                top: "60px",
                right: "auto",
                left: 0,
                transform: "none",
                width: "100%",
                height: "auto",
                flexDirection: "row",
                justifyContent: "center",
                gap: "8px",
                overflowX: "auto",
                padding: "6px",
                boxSizing: "border-box",
              }
            : null),
        }}
      >
        {cards.map((card, index) => {
          const faceUrl = getCardImageByName(card.name);
          const reversed = card.orientation === "reversed";

          return (
            <div
              key={index}
              className="trp-card"
              style={{ animationDelay: `${index * 0.16}s` }}
              onClick={() => setPreviewCard(card)}
              title={card.name}
            >
              <div
                className="trp-persp"
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  animationDelay: `${1.3 + index * 0.16}s`,
                }}
              >
                <div
                  className="trp-flip"
                  style={{
                    width: "100%",
                    height: "100%",
                    // no face image -> skip the flip, just show the back
                    animation: faceUrl
                      ? undefined
                      : "none",
                    transform: faceUrl ? undefined : "rotateY(180deg)",
                    animationDelay: `${0.62 + index * 0.16}s`,
                  }}
                >
                  {reversed && faceUrl && (
                    <span className="trp-badge">NGƯỢC</span>
                  )}

                  {/* face */}
                  <div className="trp-face front">
                    {faceUrl && (
                      <img
                        src={faceUrl}
                        alt={card.name}
                        style={{
                          transform: reversed
                            ? "rotate(180deg)"
                            : "none",
                        }}
                      />
                    )}
                  </div>

                  {/* back */}
                  <div className="trp-face back">
                    <img src={tarotBack} alt="" draggable="false" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* preview modal */}
      {previewCard && (
        <div
          onClick={() => setPreviewCard(null)}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: isMobile ? "100vw" : "380px",
            height: "100vh",
            zIndex: 999,
            background:
              "linear-gradient(180deg, rgba(12,8,24,0.96), rgba(7,5,16,0.98))",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)",
            boxShadow: "-20px 0 60px rgba(192,132,252,0.14)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "42px 28px",
            boxSizing: "border-box",
            overflow: "hidden",
            animation: "trp-slide 0.45s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* close */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewCard(null);
            }}
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: "1rem",
            }}
          >
            ✕
          </button>

          {/* glow */}
          <div
            style={{
              position: "absolute",
              top: "15%",
              width: "240px",
              height: "240px",
              borderRadius: "50%",
              background: "rgba(192,132,252,0.18)",
              filter: "blur(90px)",
              zIndex: 0,
            }}
          />

          {/* image */}
          <img
            src={getCardImageByName(previewCard.name)}
            alt={previewCard.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "270px",
              marginTop: "70px",
              borderRadius: "18px",
              zIndex: 2,
              transform:
                previewCard.orientation === "reversed"
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
              boxShadow: "0 0 45px rgba(217,70,239,0.18)",
            }}
          />

          {/* name */}
          <div
            style={{
              marginTop: "36px",
              color: "#fff",
              fontSize: "1.7rem",
              fontWeight: 700,
              textAlign: "center",
              zIndex: 2,
            }}
          >
            {previewCard.name}
          </div>

          {/* orientation */}
          <div
            style={{
              marginTop: "10px",
              color: "#d8b4fe",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontSize: "0.95rem",
              zIndex: 2,
            }}
          >
            {previewCard.orientation === "reversed" ? "Lá ngược" : "Lá xuôi"}
          </div>
        </div>
      )}
    </>
  );
}
