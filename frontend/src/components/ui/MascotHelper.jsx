import {
  CircleHelp,
  Download,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";

import tarotImages from "../../assets/tarot/tarot_json/tarot-images.json";
import guidelineContent from "../../assets/text/guideline.md?raw";
import MagicCat from "./MagicCat";
import MarkdownOverlay from "./MarkdownOverlay";

import "./MascotHelper.css";

const getCardImageSrc = (
  img
) =>
  `/src/assets/tarot/tarot_json/cards/${img}`;

const buildDeck = () =>
  (tarotImages.cards || []).map(
    (card) => ({
      name: card.name,
      src: getCardImageSrc(
        card.img
      ),
    })
  );

const drawRandomCard = (
  deck
) => {
  if (!deck.length) return null;

  const index = Math.floor(
    Math.random() * deck.length
  );

  return deck[index];
};

export default function MascotHelper() {
  const deck = useMemo(
    () => buildDeck(),
    []
  );

  const [menuOpen, setMenuOpen] =
    useState(false);
  const [drawnCard, setDrawnCard] =
    useState(null);
  const [drawKey, setDrawKey] =
    useState(0);
  const [showGuide, setShowGuide] =
    useState(false);

  const openDrawOverlay = () => {
    const card =
      drawRandomCard(deck);

    if (!card) {
      toast.error(
        "No tarot cards available."
      );
      return;
    }

    setDrawnCard(card);
    setDrawKey((prev) => prev + 1);
    setMenuOpen(false);
  };

  const handleDrawAgain = () => {
    const nextCard =
      drawRandomCard(deck);

    if (!nextCard) {
      toast.error(
        "No tarot cards available."
      );
      return;
    }

    setDrawnCard(nextCard);
    setDrawKey((prev) => prev + 1);
  };

  const handleDownload = () => {
    if (!drawnCard) return;

    const link =
      document.createElement("a");

    link.href = drawnCard.src;
    link.download =
      `${drawnCard.name
        .replace(/\s+/g, "-")
        .toLowerCase()}.jpg`;
    document.body.appendChild(
      link
    );
    link.click();
    document.body.removeChild(
      link
    );
  };

  return (
    <>
      <div className="mascot-helper">
        {menuOpen && (
          <div className="mascot-helper__menu">
            <button
              type="button"
              className="mascot-helper__bubble"
              onClick={(event) => {
                event.stopPropagation();
                setShowGuide(true);
                setMenuOpen(false);
              }}
              title="Helper tools"
            >
              <CircleHelp size={18} />
            </button>

            <button
              type="button"
              className="mascot-helper__bubble mascot-helper__bubble--card"
              onClick={(event) => {
                event.stopPropagation();
                openDrawOverlay();
              }}
              title="Draw a helper card"
            >
              <Sparkles size={18} />
            </button>
          </div>
        )}

        <MagicCat
          onClick={() =>
            setMenuOpen(
              (prev) => !prev
            )
          }
        />
      </div>

      {drawnCard && (
        <div
          className="mascot-helper__overlay"
          onClick={() =>
            setDrawnCard(null)
          }
        >
          <div
            className="mascot-helper__modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="mascot-helper__close"
              onClick={() =>
                setDrawnCard(null)
              }
            >
              <X size={18} />
            </button>

            <div
              key={drawKey}
              className="mascot-helper__draw-stage"
            >
              <div className="mascot-helper__card-glow" />
              <img
                src={drawnCard.src}
                alt={drawnCard.name}
                className="mascot-helper__card-image"
              />
              <div className="mascot-helper__card-name">
                {drawnCard.name}
              </div>
            </div>

            <div className="mascot-helper__actions">
              <button
                type="button"
                className="mascot-helper__action mascot-helper__action--ghost"
                onClick={handleDrawAgain}
              >
                <RotateCcw size={16} />
                <span>
                  Draw Again
                </span>
              </button>

              <button
                type="button"
                className="mascot-helper__action mascot-helper__action--primary"
                onClick={handleDownload}
              >
                <Download size={16} />
                <span>
                  Download
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <MarkdownOverlay
        isOpen={showGuide}
        title="CATAROT USER GUIDE"
        content={guidelineContent}
        onClose={() =>
          setShowGuide(false)
        }
      />
    </>
  );
}
