import tarotBack from "../../assets/images/homepage/tarot-back-des-2.png";

/**
 * Full-screen "the cards are being consulted" loader.
 *
 * Replaces the plain spinner: three real card-backs fan open and close like a
 * spread being shuffled/dealt, over a pulsing arcane glow, with a breathing
 * caption. One directed moment instead of a generic rotating ring.
 */
export default function MysticLoader({
  label = "Đang luận giải lá bài của bạn",
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "30px",
        background: "rgba(3, 2, 10, 0.62)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      <style>
        {`
          @keyframes ml-glow {
            0%, 100% { transform: scale(0.9); opacity: 0.45; }
            50%      { transform: scale(1.15); opacity: 0.8; }
          }
          /* left card fans out to the left and back */
          @keyframes ml-fan-a {
            0%, 100% { transform: translateX(0) translateY(0) rotate(0deg); }
            32%, 60% { transform: translateX(-58px) translateY(8px) rotate(-19deg); }
          }
          /* centre card lifts + breathes */
          @keyframes ml-fan-b {
            0%, 100% { transform: translateY(0) scale(1); }
            32%, 60% { transform: translateY(-12px) scale(1.06); }
          }
          /* right card fans out to the right and back */
          @keyframes ml-fan-c {
            0%, 100% { transform: translateX(0) translateY(0) rotate(0deg); }
            32%, 60% { transform: translateX(58px) translateY(8px) rotate(19deg); }
          }
          @keyframes ml-dots {
            0%   { opacity: 0.2; }
            50%  { opacity: 1; }
            100% { opacity: 0.2; }
          }
          @keyframes ml-caption {
            0%, 100% { opacity: 0.6; }
            50%      { opacity: 1; }
          }
          .ml-stage {
            position: relative;
            width: 190px;
            height: 150px;
          }
          .ml-glow {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 230px;
            height: 230px;
            margin: -115px 0 0 -115px;
            border-radius: 50%;
            background: radial-gradient(
              circle,
              rgba(217, 70, 239, 0.5),
              rgba(139, 92, 246, 0.18) 45%,
              transparent 70%
            );
            filter: blur(26px);
            animation: ml-glow 2.4s ease-in-out infinite;
          }
          .ml-card {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 70px;
            height: 112px;
            margin: -56px 0 0 -35px;
            border-radius: 11px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.28);
            box-shadow: 0 10px 26px rgba(0, 0, 0, 0.5),
              0 0 22px rgba(192, 132, 252, 0.4);
            will-change: transform;
            transform-origin: bottom center;
          }
          .ml-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .ml-card.a { animation: ml-fan-a 2.4s ease-in-out infinite; z-index: 1; }
          .ml-card.b { animation: ml-fan-b 2.4s ease-in-out infinite; z-index: 3; }
          .ml-card.c { animation: ml-fan-c 2.4s ease-in-out infinite; z-index: 2; }
          .ml-caption {
            display: flex;
            align-items: center;
            gap: 4px;
            color: #f0e2ff;
            font-size: 1.02rem;
            letter-spacing: 0.06em;
            text-shadow: 0 0 18px rgba(217, 70, 239, 0.55);
            animation: ml-caption 2.4s ease-in-out infinite;
          }
          .ml-caption .ml-dot {
            animation: ml-dots 1.4s ease-in-out infinite;
          }
          .ml-caption .ml-dot:nth-child(2) { animation-delay: 0.2s; }
          .ml-caption .ml-dot:nth-child(3) { animation-delay: 0.4s; }
          @media (prefers-reduced-motion: reduce) {
            .ml-glow, .ml-card, .ml-caption, .ml-caption .ml-dot {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="ml-stage">
        <div className="ml-glow" />
        <div className="ml-card a">
          <img src={tarotBack} alt="" draggable="false" />
        </div>
        <div className="ml-card c">
          <img src={tarotBack} alt="" draggable="false" />
        </div>
        <div className="ml-card b">
          <img src={tarotBack} alt="" draggable="false" />
        </div>
      </div>

      <div className="ml-caption">
        <span>{label}</span>
        <span className="ml-dot">.</span>
        <span className="ml-dot">.</span>
        <span className="ml-dot">.</span>
      </div>
    </div>
  );
}
