import CardNav from "../components/layout/CardNav";
import ContactPanel from "../components/ui/ContactPanel";
import MarkdownOverlay from "../components/ui/MarkdownOverlay";
import Shuffle from "../components/ui/Shuffle";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import whatIsTarotContent from "../assets/text/what_is_tarot.md?raw";
import catarotContent from "../assets/text/catarot.md?raw";
import { useAppSettings } from "../context/AppSettingsContext";
import useIsMobile from "../hooks/useIsMobile";
import LandingCosmos from "../components/common/LandingCosmos";
import "./LandingPage.css";

export default function LandingPage() {

  const navigate = useNavigate();
  const { t } = useAppSettings();
  const isMobile = useIsMobile();
  const [showContact, setShowContact] =
    useState(false);
  const [activeMarkdownDoc, setActiveMarkdownDoc] =
    useState(null);

  const items = [
    {
      label: t("nav_reading"),
      bgColor: "rgba(25, 18, 40, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: t("nav_reflection_history"),
          onClick: () => navigate("/login"),
        },
        {
          label: t("nav_reading_history"),
          onClick: () => navigate("/login"),
        },
      ],
    },

    {
      label: t("nav_tarot"),
      bgColor: "rgba(40, 22, 60, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: t("nav_what_is_tarot"),
          onClick: () =>
            setActiveMarkdownDoc({
              title:
                t("overlay_what_is_tarot"),
              content:
                whatIsTarotContent,
            }),
        },
        {
          label: t("nav_catarot"),
          onClick: () =>
            setActiveMarkdownDoc({
              title:
                t("overlay_catarot"),
              content:
                catarotContent,
            }),
        },
      ],
    },

    {
      label: t("nav_contact"),
      bgColor: "rgba(30, 16, 50, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: t("nav_more_info"),
          onClick: () =>
            setShowContact(true),
        },
      ],
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",

        overflow: "hidden",

        background: `
          radial-gradient(circle at top left, rgba(168,85,247,0.18), transparent 30%),
          radial-gradient(circle at top right, rgba(236,72,153,0.12), transparent 25%),
          linear-gradient(to bottom, #050510, #090114, #020205)
        `,

        position: "relative",

        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Nền: desktop = vũ trụ sống động (nebula + tinh tú parallax theo chuột);
          mobile = lưới sao tĩnh nhẹ (giữ nguyên như cũ). */}
      {isMobile ? (
        <div
          style={{
            position: "absolute",
            inset: 0,

            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",

            backgroundSize: "50px 50px",

            opacity: 0.08,

            pointerEvents: "none",
          }}
        />
      ) : (
        <LandingCosmos />
      )}

      {/* NAVBAR */}
      <CardNav
        logo=""
        items={items}

        buttonLabel={t("signup_submit")}

        onButtonClick={() => navigate("/login")}

        baseColor="rgba(10,10,25,0.55)"
        menuColor="#fff"

        buttonBgColor="rgba(168,85,247,0.18)"
        buttonTextColor="#fff"
      />

      <ContactPanel
        isOpen={showContact}
        onClose={() =>
          setShowContact(false)
        }
      />

      <MarkdownOverlay
        isOpen={Boolean(activeMarkdownDoc)}
        title={activeMarkdownDoc?.title}
        content={activeMarkdownDoc?.content}
        onClose={() =>
          setActiveMarkdownDoc(null)
        }
      />

      {/* HERO TITLE */}
      <div
        style={{
          position: "relative",
          zIndex: 2,

          // Trước đây width cố định 1400px → trên điện thoại bị cắt hai bên (khung
          // rộng hơn màn hình, container ngoài overflow:hidden cắt cụt). Cho co theo
          // màn hình + chừa lề để vừa mọi cỡ.
          width: "100%",
          maxWidth: "1400px",
          minHeight: "500px",
          padding: "0 20px",
          boxSizing: "border-box",

          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "22px",
        }}
      >
        <Shuffle
          text="CATAROT"
          tag="div"
          duration={1600}
          // Desktop: chữ mạ ánh kim (class landing-wordmark). Mobile: giữ nguyên trắng + glow.
          className={isMobile ? "" : "landing-wordmark"}
          style={{
            // Sàn nhỏ hơn để tiêu đề co vừa màn hình điện thoại (trước 5.8rem ~93px
            // quá to → "CATAROT" tràn ngang, bị cắt hai bên).
            fontSize: "clamp(2.6rem, 12vw, 9.4rem)",
            maxWidth: "100%",
            letterSpacing: "0.08em",
            ...(isMobile
              ? {
                  color: "#f8f4ff",
                  textShadow:
                    "0 0 24px rgba(192,132,252,0.16), 0 0 60px rgba(217,70,239,0.14)",
                  filter: "drop-shadow(0 0 28px rgba(168,85,247,0.18))",
                }
              : null),
          }}
        />

        <div
          style={{
            maxWidth: "920px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "-6px",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: "clamp(0.98rem, 1.3vw, 1.12rem)",
              lineHeight: 1.7,
              maxWidth: "760px",
              margin: "0 auto",
            }}
          >
            Khám phá Tarot theo cách trực quan hơn với AI,
            những phiên đọc bài cá nhân, trải nghiệm hằng
            ngày và không gian lưu giữ những điều bạn chưa
            kịp gọi tên.
          </div>
        </div>

        {/* CTA hero — chỉ mobile (desktop giữ nguyên, vào bằng nút "Đăng ký" trên nav). */}
        {isMobile && (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="landing-hero-cta"
            style={{
              marginTop: "14px",
              padding: "15px 34px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.16)",
              background:
                "linear-gradient(135deg, rgba(168,85,247,0.96), rgba(236,72,153,0.94))",
              color: "#fff",
              fontSize: "1.08rem",
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor: "pointer",
              boxShadow: "0 0 34px rgba(168,85,247,0.42)",
            }}
          >
            ✦ Khám phá ngay
          </button>
        )}

        {/* CTA hero desktop — điểm nhấn chính (trước desktop chỉ có nút nhỏ trên nav). */}
        {!isMobile && (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="landing-hero-cta-desktop"
          >
            ✦ Bước vào cánh cổng
          </button>
        )}
      </div>
    </div>
  );
}
