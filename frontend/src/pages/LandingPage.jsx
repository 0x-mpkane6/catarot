import CardNav from "../components/layout/CardNav";
import ContactPanel from "../components/ui/ContactPanel";
import MarkdownOverlay from "../components/ui/MarkdownOverlay";
import Shuffle from "../components/ui/Shuffle";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import whatIsTarotContent from "../assets/text/what_is_tarot.md?raw";
import catarotContent from "../assets/text/catarot.md?raw";

export default function LandingPage() {

  const navigate = useNavigate();
  const [showContact, setShowContact] =
    useState(false);
  const [activeMarkdownDoc, setActiveMarkdownDoc] =
    useState(null);

  const items = [
    {
      label: "Xem Bài",
      bgColor: "rgba(25, 18, 40, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: "Lịch sử chiêm nghiệm",
          onClick: () => navigate("/login"),
        },
        {
          label: "Lịch sử trải bài",
          onClick: () => navigate("/login"),
        },
      ],
    },

    {
      label: "Tarot",
      bgColor: "rgba(40, 22, 60, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: "Tarot là gì?",
          onClick: () =>
            setActiveMarkdownDoc({
              title:
                "TAROT LÀ GÌ?",
              content:
                whatIsTarotContent,
            }),
        },
        {
          label: "Catarot",
          onClick: () =>
            setActiveMarkdownDoc({
              title:
                "CATAROT",
              content:
                catarotContent,
            }),
        },
      ],
    },

    {
      label: "Liên hệ",
      bgColor: "rgba(30, 16, 50, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: "Thông tin thêm",
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
      {/* STARS */}
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

      {/* NAVBAR */}
      <CardNav
        logo=""
        items={items}

        buttonLabel="Bắt đầu"

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

          width: "1400px",
          minHeight: "500px",

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
          style={{
            fontSize: "clamp(5.8rem, 10vw, 9.4rem)",
            maxWidth: "100%",
            color: "#f8f4ff",
            letterSpacing: "0.08em",
            textShadow:
              "0 0 24px rgba(192,132,252,0.16), 0 0 60px rgba(217,70,239,0.14)",
            filter:
              "drop-shadow(0 0 28px rgba(168,85,247,0.18))",
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
      </div>
    </div>
  );
}
