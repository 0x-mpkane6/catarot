import ASCIIText from "../components/layout/ASCIIText";
import CardNav from "../components/layout/CardNav";

import { useNavigate } from "react-router-dom";

export default function LandingPage() {

  const navigate = useNavigate();

  const items = [
    {
      label: "Readings",
      bgColor: "rgba(25, 18, 40, 0.82)",
      textColor: "#ffffff",
      links: [
        { label: "Daily Tarot" },
        { label: "Love Reading" },
      ],
    },

    {
      label: "Arcana",
      bgColor: "rgba(40, 22, 60, 0.82)",
      textColor: "#ffffff",
      links: [
        { label: "Major Arcana" },
        { label: "Minor Arcana" },
      ],
    },

    {
      label: "Contact",
      bgColor: "rgba(30, 16, 50, 0.82)",
      textColor: "#ffffff",
      links: [
        { label: "Github" },
        { label: "Discord" },
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

        buttonLabel="Get Started"

        onButtonClick={() => navigate("/login")}

        baseColor="rgba(10,10,25,0.55)"
        menuColor="#fff"

        buttonBgColor="rgba(168,85,247,0.18)"
        buttonTextColor="#fff"
      />

      {/* ASCII TITLE */}
      <div
        style={{
          position: "relative",
          zIndex: 2,

          width: "1400px",
          height: "500px",

          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ASCIIText
          text="CATAROT"
          enableWaves={true}
          asciiFontSize={8}
          textFontSize={150}
          planeBaseHeight={10}
        />
      </div>
    </div>
  );
}