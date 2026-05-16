import CardNav from "../components/layout/CardNav";
import UserProfile from "../components/ui/UserProfile";
import ReadingHistory from "../components/ui/ReadingHistory";
import MagicCat from "../components/ui/MagicCat";
import ContactPanel from "../components/ui/ContactPanel";
import TarotGallery from "../components/ui/TarotGallery";
import ChatBox from "../components/ui/ChatBox";
import { useState } from "react";

import { Undo2 } from "lucide-react";

export default function HomePage() {

  const [showProfile, setShowProfile] = useState(false);

  // Username
  const username = "0x-mpkane6";

  // const [username, setUsername] = useState("");

  // Reading History
  const [showHistory, setShowHistory] = useState(false);

  // Contact Panel
  const [showContact, setShowContact] = useState(false);

  // Selected Card
  const [selectedCard, setSelectedCard] = useState(null);
  const [hideGallery, setHideGallery] = useState(false);
  const [showChatUI, setShowChatUI] = useState(false);

  const handleCardClick = (card) => {

    setHideGallery(true);

    setShowChatUI(false);

    setTimeout(() => {

      setSelectedCard(card);

      setShowChatUI(true);

    }, 500);
  };

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
        { label: "More Info",
          onClick: () => { setShowContact(true); 

          } 
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

      <ContactPanel
        isOpen={showContact}

        onClose={() => {
          setShowContact(false);
        }}
      />

    <div
      style={{
        opacity: hideGallery ? 0 : 1,
        transform: hideGallery
          ? "translateY(30px)"
          : "translateY(0px)",

        transition:
          "all 0.5s ease",

        pointerEvents:
          hideGallery ? "none" : "auto",
      }}
    >
      <TarotGallery
        onCardClick={handleCardClick}
      />
    </div>

    {selectedCard && (
      <Undo2
      onClick={() => {
        setShowChatUI(false);

        setTimeout(() => {

          setSelectedCard(null);

          setHideGallery(false);

        }, 250);
      }}

        size={34}

        style={{
          position: "absolute",

          top: "50px",
          left: "50px",

          color: "#f3d0ff",

          cursor: "pointer",

          zIndex: 30,

          transition: "0.25s ease",

          filter:
            "drop-shadow(0 0 10px rgba(192,132,252,0.45))",
        }}

        onMouseEnter={(e) => {
          e.currentTarget.style.transform =
            "scale(1.15)";

          e.currentTarget.style.filter =
            "drop-shadow(0 0 18px rgba(192,132,252,0.9))";
        }}

        onMouseLeave={(e) => {
          e.currentTarget.style.transform =
            "scale(1)";

          e.currentTarget.style.filter =
            "drop-shadow(0 0 10px rgba(192,132,252,0.45))";
        }}
      />
    )}
  

   {showChatUI && selectedCard && (
      <div
        style={{
          position: "absolute",

          left: "70px",
          top: "110px",

          opacity: showChatUI ? 1 : 0,

          transform:
            showChatUI
              ? "translateY(0px)"
              : "translateY(30px)",

          transition:
            "all 0.5s ease",

          zIndex: 10,
        }}
      >
        <img
          src={selectedCard.image}
          alt={selectedCard.text}

          style={{
            width: "170px",
            borderRadius: "18px",
          }}
        />

        <div
          style={{
            marginTop: "12px",

            width: "170px",

            textAlign: "center",

            color: "#fff",

            fontSize: "1.15rem",
            fontWeight: 700,
          }}
        >
          {selectedCard.text}
        </div>
      </div>
    )}

    {showChatUI && (
      <div
        style={{
          position: "absolute",

          width: "700px",
          left: "50%",
          bottom: "80px",

          transform: "translateX(-50%)",

          opacity: showChatUI ? 1 : 0,

          transition: "0.5s ease",

          zIndex: 20,
        }}
      >
        <ChatBox />
      </div>
    )}

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