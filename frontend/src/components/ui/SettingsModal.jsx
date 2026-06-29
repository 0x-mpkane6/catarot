import { X } from "lucide-react";

import { useAppSettings } from "../../context/AppSettingsContext";

// Modal Cài đặt dùng chung — mở được từ menu ☰ trên mobile (trước đây cài đặt chỉ
// nằm trong mascot, mà mascot bị ẩn trên điện thoại → không tắt được nhạc/TTS).
// Đặt giữa màn hình nên không phụ thuộc vị trí góc, an toàn mọi cỡ.
export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings, t } = useAppSettings();

  if (!isOpen) return null;

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: "#f3d0ff",
    fontSize: "0.96rem",
    padding: "12px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  };

  const toggleStyle = (on) => ({
    minWidth: "52px",
    height: "30px",
    borderRadius: "999px",
    border: "1px solid rgba(192,132,252,0.3)",
    background: on
      ? "linear-gradient(135deg, #c084fc, #e879f9)"
      : "rgba(255,255,255,0.06)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
  });

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("settings_title")}
        style={{
          position: "relative",
          width: "min(380px, 92vw)",
          maxHeight: "86vh",
          overflowY: "auto",
          padding: "20px",
          borderRadius: "20px",
          border: "1px solid rgba(192,132,252,0.2)",
          background:
            "linear-gradient(180deg, rgba(22,14,38,0.98), rgba(10,7,22,0.98))",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          color: "#fff",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: "1.2rem",
              fontWeight: 700,
            }}
          >
            {t("settings_title")}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={rowStyle}>
          <span>{t("settings_sound")}</span>
          <button
            type="button"
            aria-pressed={settings.mascotSoundEnabled}
            onClick={() =>
              updateSettings({ mascotSoundEnabled: !settings.mascotSoundEnabled })
            }
            style={toggleStyle(settings.mascotSoundEnabled)}
          >
            {settings.mascotSoundEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{t("settings_music_volume")}</span>
            <strong>
              {Math.round(Number(settings.backgroundMusicVolume || 0) * 100)}%
            </strong>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            aria-label={t("settings_music_volume")}
            value={Math.round(Number(settings.backgroundMusicVolume || 0) * 100)}
            onChange={(e) =>
              updateSettings({ backgroundMusicVolume: Number(e.target.value) / 100 })
            }
            style={{ width: "100%" }}
          />
        </div>

        <div style={rowStyle}>
          <span>{t("settings_cursor")}</span>
          <button
            type="button"
            aria-pressed={settings.cursorEffectsEnabled}
            onClick={() =>
              updateSettings({ cursorEffectsEnabled: !settings.cursorEffectsEnabled })
            }
            style={toggleStyle(settings.cursorEffectsEnabled)}
          >
            {settings.cursorEffectsEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div style={rowStyle}>
          <span>{t("settings_speech")}</span>
          <button
            type="button"
            aria-pressed={settings.speechPlaybackEnabled}
            onClick={() =>
              updateSettings({ speechPlaybackEnabled: !settings.speechPlaybackEnabled })
            }
            style={toggleStyle(settings.speechPlaybackEnabled)}
          >
            {settings.speechPlaybackEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </div>
  );
}
