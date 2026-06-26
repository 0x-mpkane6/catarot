import ScrollVelocity
from "./ScrollVelocity";
import { useAppSettings } from "../../context/AppSettingsContext";

export default function ContactPanel({
  isOpen,
  onClose,
}) {
  const { t } = useAppSettings();

  return (
    <>
      {/* BACKDROP */}
      <div
        onClick={onClose}

        style={{
          position: "fixed",
          inset: 0,

          background:
            "rgba(0,0,0,0.28)",

          backdropFilter:
            "blur(6px)",

          opacity: isOpen ? 1 : 0,

          pointerEvents:
            isOpen ? "auto" : "none",

          transition: "0.35s ease",

          zIndex: 120,
        }}
      />

      {/* PANEL */}
      <div
        style={{
          position: "fixed",

          top: 0,
          right: 0,

          width: "35%",
          minWidth: "min(520px, 100vw)",

          height: "100vh",

          background:
            "linear-gradient(to bottom, rgba(15,10,30,0.95), rgba(8,5,18,0.98))",

          borderLeft:
            "1px solid rgba(168,85,247,0.14)",

          backdropFilter:
            "blur(24px)",

          boxShadow:
            "-20px 0 60px rgba(0,0,0,0.45)",

          transform: isOpen
            ? "translateX(0)"
            : "translateX(100%)",

          transition:
            "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",

          zIndex: 130,

          padding: "42px",

          boxSizing: "border-box",

          overflowY: "auto",
          overflowX: "hidden",
        }}
      >

        {/* TITLE */}
        <div
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            color: "#fff",

            fontSize: "2.2rem",
            fontWeight: 700,

            marginBottom: "24px",
          }}
        >
          {t("contact_title")}
        </div>

        {/* SCROLL VELOCITY */}
        <div
        style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",

            marginBottom: "48px",

            opacity: 0.18,
        }}
        >

        <ScrollVelocity
            texts={[
            "UNIVERSITY OF INFORMATION TECHNOLOGY ✦ VIETNAM NATIONAL UNIVERSITY ✦ ATTN2024 ✦",
            ]}

            velocity={70}

            scrollerStyle={{
            color: "#c084fc",
            fontWeight: 700,
            fontSize: "3rem",
            }}
        />

        <ScrollVelocity
            texts={[
            "CATAROT ✦ NGUYEN MINH PHUC KHANG ✦ TRANG TUAN ANH ✦",
            ]}

            velocity={-70}

            scrollerStyle={{
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "3rem",
            }}
        />

        </div>

        {/* CONTACT ITEMS */}
        <div
          style={{
            display: "flex",

            flexDirection: "column",

            gap: "18px",
          }}
        >

          <div style={cardStyle}>
            <div style={labelStyle}>
              {t("contact_github")}
            </div>

            <div style={valueStyle}>
              github.com/0x-mpkane6 - github.com/TrangTuanAnh
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>
              {t("contact_discord")}
            </div>

            <div style={valueStyle}>
              0x_mpkane6 - horiz_06
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>
              {t("contact_email")}
            </div>

            <div style={valueStyle}>
              24520758@gm.uit.edu.vn - 24520131@gm.uit.edu.vn
            </div>
          </div>

          <div style={advisorStyle}>
            {t("contact_advisor")}
          </div>

        </div>
      </div>
    </>
  );
}

const cardStyle = {

  padding: "20px",

  borderRadius: "20px",

  background:
    "rgba(255,255,255,0.03)",

  border:
    "1px solid rgba(168,85,247,0.12)",

  backdropFilter:
    "blur(12px)",

  transition: "0.25s ease",

  cursor: "pointer",
};

const labelStyle = {

  color: "#c084fc",

  fontSize: "0.9rem",

  marginBottom: "6px",
};

const valueStyle = {

  color: "#d8c8ff",

  fontSize: "1.05rem",

  fontWeight: 600,
};

const advisorStyle = {
  marginTop: "4px",
  color: "#fde68a",
  fontSize: "1rem",
  fontStyle: "italic",
  lineHeight: 1.6,
};
