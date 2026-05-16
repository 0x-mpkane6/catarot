import CardNav from "../components/layout/CardNav";
import UserProfile from "../components/ui/UserProfile";
import ReadingHistory from "../components/ui/ReadingHistory";
import MagicCat from "../components/ui/MagicCat";
import { useState } from "react";

export default function HomePage() {

  const [showProfile, setShowProfile] = useState(false);

  // Username
  const username = "0x-mpkane6";

  // const [username, setUsername] = useState("");

  // Reading History
  const [showHistory, setShowHistory] = useState(false);

  const items = [
    {
      label: "Readings",
      bgColor: "rgba(25, 18, 40, 0.82)",
      textColor: "#ffffff",
      links: [
        { label: "Daily Tarot" },
        { label: "Reading History", 
          onClick: () => setShowHistory(true) },
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
      }}
    >

      {/* NAVBAR */}
      <CardNav
        logo=""
        items={items}

        buttonLabel={username || "User"}

        onButtonClick={() => {
          setShowProfile(true);
        }}

        baseColor="rgba(10,10,25,0.55)"
        menuColor="#fff"

        buttonBgColor="rgba(168,85,247,0.18)"
        buttonTextColor="#fff"
      />

        
      <UserProfile
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        username={username}
      />

      <ReadingHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      <MagicCat
        onClick={() => {
          console.log("meow");
        }}
      />

      {/* stars */}
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
    </div>
  );
}