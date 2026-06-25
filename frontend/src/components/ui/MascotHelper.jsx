import {
  CircleHelp,
  Download,
  Settings,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";

import tarotImages from "../../assets/tarot/tarot_json/tarot-images.json";
import { getCardImageByFile } from "../../lib/cardImages";
import guidelineContent from "../../assets/text/guideline.md?raw";
import MagicCat from "./MagicCat";
import MarkdownOverlay from "./MarkdownOverlay";
import { useAppSettings } from "../../context/AppSettingsContext";

import "./MascotHelper.css";

const getCardImageSrc = (img) => getCardImageByFile(img);

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

const MENU_CLOSE_DURATION_MS = 220;

export default function MascotHelper() {
  const { settings, updateSettings, t } = useAppSettings();
  const helperRef = useRef(null);
  const deck = useMemo(
    () => buildDeck(),
    []
  );

  const [menuOpen, setMenuOpen] =
    useState(false);
  const [menuMounted, setMenuMounted] =
    useState(false);
  const [drawnCard, setDrawnCard] =
    useState(null);
  const [drawKey, setDrawKey] =
    useState(0);
  const [showGuide, setShowGuide] =
    useState(false);
  const [showSettings, setShowSettings] =
    useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
    setShowSettings(false);
  };

  const toggleMenu = () => {
    // Mount NGAY khi mở (đặt state trong event handler, không phải trong effect) — khi đóng
    // thì effect bên dưới mới hẹn giờ unmount sau hiệu ứng. Tránh setState đồng bộ trong effect.
    if (!menuOpen) {
      setMenuMounted(true);
    }
    setMenuOpen((prev) => !prev);
    setShowSettings(false);
  };

  useEffect(() => {
    if (menuOpen) {
      return undefined;
    }

    if (!menuMounted) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMenuMounted(false);
    }, MENU_CLOSE_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [menuMounted, menuOpen]);

  useEffect(() => {
    if (!menuMounted) return undefined;

    const handlePointerDown = (event) => {
      if (!helperRef.current?.contains(event.target)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [menuMounted]);

  const openDrawOverlay = () => {
    const card =
      drawRandomCard(deck);

    if (!card) {
      toast.error(
        t("mascot_no_cards")
      );
      return;
    }

    setDrawnCard(card);
    setDrawKey((prev) => prev + 1);
    closeMenu();
  };

  const handleDrawAgain = () => {
    const nextCard =
      drawRandomCard(deck);

    if (!nextCard) {
      toast.error(
        t("mascot_no_cards")
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
      <div
        ref={helperRef}
        className="mascot-helper"
      >
        {menuMounted && (
          <div className="mascot-helper__menu">
            <button
              type="button"
              className={`mascot-helper__bubble ${menuOpen ? "is-open" : "is-closing"}`}
              onClick={(event) => {
                event.stopPropagation();
                setShowGuide(true);
                closeMenu();
              }}
              title={t("mascot_tools")}
            >
              <CircleHelp size={18} />
            </button>

            <button
              type="button"
              className={`mascot-helper__bubble mascot-helper__bubble--card ${menuOpen ? "is-open" : "is-closing"}`}
              onClick={(event) => {
                event.stopPropagation();
                openDrawOverlay();
              }}
              title={t("mascot_draw")}
            >
              <Sparkles size={18} />
            </button>

            <button
              type="button"
              className={`mascot-helper__bubble mascot-helper__bubble--settings ${menuOpen ? "is-open" : "is-closing"}`}
              onClick={(event) => {
                event.stopPropagation();
                setShowSettings((prev) => !prev);
              }}
              title={t("mascot_settings")}
            >
              <Settings size={18} />
            </button>

            {showSettings && (
              <div
                className={`mascot-helper__settings ${menuOpen ? "is-open" : "is-closing"}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mascot-helper__settings-title">
                  {t("settings_title")}
                </div>

                <div className="mascot-helper__settings-row">
                  <span>{t("settings_sound")}</span>
                  <button
                    type="button"
                    className={`mascot-helper__toggle ${settings.mascotSoundEnabled ? "is-on" : ""}`}
                    onClick={() =>
                      updateSettings({
                        mascotSoundEnabled: !settings.mascotSoundEnabled,
                      })
                    }
                  >
                    {settings.mascotSoundEnabled ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="mascot-helper__settings-row mascot-helper__settings-row--stack">
                  <div className="mascot-helper__settings-volume-header">
                    <span>{t("settings_music_volume")}</span>
                    <strong>
                      {Math.round(
                        Number(settings.backgroundMusicVolume || 0) * 100
                      )}
                      %
                    </strong>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    className="mascot-helper__volume-slider"
                    value={Math.round(
                      Number(settings.backgroundMusicVolume || 0) * 100
                    )}
                    onChange={(event) =>
                      updateSettings({
                        backgroundMusicVolume:
                          Number(event.target.value) / 100,
                      })
                    }
                  />
                </div>

                <div className="mascot-helper__settings-row">
                  <span>{t("settings_cursor")}</span>
                  <button
                    type="button"
                    className={`mascot-helper__toggle ${settings.cursorEffectsEnabled ? "is-on" : ""}`}
                    onClick={() =>
                      updateSettings({
                        cursorEffectsEnabled: !settings.cursorEffectsEnabled,
                      })
                    }
                  >
                    {settings.cursorEffectsEnabled ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="mascot-helper__settings-row">
                  <span>{t("settings_speech")}</span>
                  <button
                    type="button"
                    className={`mascot-helper__toggle ${settings.speechPlaybackEnabled ? "is-on" : ""}`}
                    onClick={() =>
                      updateSettings({
                        speechPlaybackEnabled: !settings.speechPlaybackEnabled,
                      })
                    }
                  >
                    {settings.speechPlaybackEnabled ? "ON" : "OFF"}
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

        <MagicCat
          onClick={toggleMenu}
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
                  {t("mascot_redraw")}
                </span>
              </button>

              <button
                type="button"
                className="mascot-helper__action mascot-helper__action--primary"
                onClick={handleDownload}
              >
                <Download size={16} />
                <span>
                  {t("mascot_download")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <MarkdownOverlay
        isOpen={showGuide}
        title={t("guide_title")}
        content={guidelineContent}
        onClose={() =>
          setShowGuide(false)
        }
      />
    </>
  );
}
