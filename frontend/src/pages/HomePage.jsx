import CardNav from "../components/layout/CardNav";
import UserProfile from "../components/ui/UserProfile";
import ReadingHistory from "../components/ui/ReadingHistory";
import MagicCat from "../components/ui/MagicCat";
import ContactPanel from "../components/ui/ContactPanel";
import TarotGallery from "../components/ui/TarotGallery";
import ChatBox from "../components/ui/ChatBox";
import TarotSpreadGrid from "../components/ui/TarotSpreadGrid";

import DailyChatBox
from "../components/ui/DailyChatBox";

import DailyResultPanel
from "../components/ui/DailyResultPanel";

import {
  getConversation,
} from "../services/historyService";

import {
  saveSessionMeta,
} from "../services/sessionCache";

import ScrollStyle
from "../components/common/Scroll";

import TarotResultPanel
from "../components/ui/TarotResultPanel";

import ChatConversation
from "../components/ui/ChatConversation";

import { useState } from "react";

import {
  askTarotQuestion,
} from "../services/tarotService";

import {
  askDailyQuestion,
} 

from "../services/dailyService";

  import {
  reflectDailyCard
}

from "../services/dailyService";

import toast from "react-hot-toast";

import { Undo2 } from "lucide-react";

export default function HomePage() {

  const [messages, setMessages] =
  useState([]);

  const [revealedCards, setRevealedCards] =
    useState([]);

  const [showResult, setShowResult] =
    useState(false);

  const [isToastVisible, setIsToastVisible] = useState(false);

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
  const [showSpreadGrid, setShowSpreadGrid] = useState(false);
  const [pendingInput, setPendingInput] = useState(null);
  const [isBackendLoading, setIsBackendLoading] = useState(false);

  // eslint-disable-next-line no-unused-vars -- TODO: hook up session reuse
  const [currentSession, setCurrentSession] = useState(null);

  const requiredCards =
    selectedCard?.mode === "daily" ? 1 : 3;

    const handleReflectSubmit =
  async (
    cardId,
    reflectionData
  ) => {

    try {

      const updatedCard =
        await reflectDailyCard(
          cardId,
          reflectionData
        );

      setRevealedCards((prev) => {

        if (!prev?.length)
          return prev;

        return [
          {
            ...prev[0],

            ...updatedCard,

            reflection:
              updatedCard.reflection
              ?? reflectionData.reflection,

            mood_post:
              updatedCard.mood_post
              ?? reflectionData.mood_post,
          },
        ];
      });

      toast.success(
        "Reflection saved"
      );

    } catch (error) {

      console.error(error);

      toast.error(
        error.message ||
        "Failed to save reflection"
      );
    }
};

  const handleDailySubmit =
  async ({
    mood_pre,
    question,
  }) => {

    try {

      setIsBackendLoading(true);

      const response =
        await askDailyQuestion({
          mood_pre,
          question,
        });

      console.log(
        "daily response",
        response
      );

      const dailyItem =
        response?.item;

      if (!dailyItem) {

        toast.error(
          "No daily card returned"
        );

        return;
      }

      setMessages([
        {
          role: "user",

          content:
            question ||
            mood_pre,
        },

        {
          role: "assistant",

          content:
            dailyItem?.affirmation
            || "Your daily card has arrived.",
        },
      ]);

      setRevealedCards([
        dailyItem,
      ]);

      setShowSpreadGrid(false);

      setShowResult(true);

      toast.success(
        response.alreadyDrawn
          ? "Today's card already exists"
          : "Daily card drawn"
      );

    } catch (error) {

      console.error(error);

      toast.error(
        error.message ||
        "Failed to draw daily card"
      );

    } finally {

      setIsBackendLoading(false);
    }
};
  const handleCardClick = (card) => {

    // feature chưa làm
   if (
      card.mode !== "daily" &&
      card.mode !== "reading"
    ) {

      if (!isToastVisible) {

        setIsToastVisible(true);

        toast.error(
          "This feature is currently under development.",
          {
            duration: 1800,
          }
        );

        setTimeout(() => {
          setIsToastVisible(false);
        }, 1800);
      }

      return;
    }

    // chống spam click
    if (hideGallery) return;

    setHideGallery(true);

    setShowChatUI(false);

    setTimeout(() => {

      setSelectedCard(card);

      setShowChatUI(true);
      setShowSpreadGrid(false);
      setPendingInput(null);

    }, 500);
  };

const handleChatSubmitDraft =
  async (draft) => {

    const hasImages =
      draft.images?.length > 0;

    // IMAGE MODE
    // -> skip spread grid
    if (hasImages) {

      try {

        setIsBackendLoading(true);

        const response =
          await askTarotQuestion({
            question:
              draft.question,

            images:
              draft.images,

            audio:
              draft.audio,
          });

        setMessages([
          {
            role: "user",
            content:
              draft.question,
          },

          {
            role: "assistant",
            content:
              response.final_answer,
          },
        ]);

        setRevealedCards(
          response.cards || []
        );

        setShowResult(true);

        const sessionMeta = {
          sessionId:
            response.session_id,

          title:
            draft.question ||
            "Untitled Reading",

          mode:
            selectedCard.mode,

          createdAt:
            new Date().toISOString(),
        };

        saveSessionMeta(
          sessionMeta
        );

        setCurrentSession(
          sessionMeta
        );

        toast.success(
          "Reading complete"
        );

      } catch (error) {

        console.error(error);

        toast.error(
          "Something went wrong"
        );

      } finally {

        setIsBackendLoading(false);
      }

      return;
    }

    // TEXT / AUDIO
    // -> still open spread grid
    setPendingInput(draft);

    setShowSpreadGrid(true);
};

  const handleSpreadConfirm = async (selectedCards) => {
    if (!pendingInput || !selectedCard) return;

    if (selectedCards.length < requiredCards) {
      toast.error(
        `Please select ${requiredCards} card${requiredCards > 1 ? "s" : ""} before continuing.`
      );
      return;
    }

    try {
      setIsBackendLoading(true);

      let response = null;
      if (selectedCard.mode === "daily") {
          response = await askDailyQuestion({
          question: pendingInput.question,
          selectedCards,
        });

        console.log("daily response", response);

        setMessages([
        {
          role: "user",
          content:
            pendingInput.question,
        },

        {
          role: "assistant",
          content:
            response.final_answer,
        },
      ]);

      setRevealedCards(
        response.cards || []
      );

      setShowResult(true);

        toast.success(
          response.alreadyDrawn
            ? "Today's card is already drawn"
            : "Daily card drawn"
        );
      } else {
        response = await askTarotQuestion({
          question: pendingInput.question,
          images: pendingInput.images,
          audio: pendingInput.audio,
          selectedCards,
        });

        console.log("tarot response", response);

        setMessages([
        {
          role: "user",
          content:
            pendingInput.question,
        },

        {
          role: "assistant",
          content:
            response.final_answer,
        },
      ]);

      setRevealedCards(
        response.cards || []
      );

      setShowResult(true);

        toast.success("Reading complete");
      }

      const sessionMeta = {
        sessionId:
          response.session_id,

        title:
          pendingInput.question ||
          "Untitled Reading",

        mode:
          selectedCard.mode,

        createdAt:
          new Date().toISOString(),
      };

      saveSessionMeta(
        sessionMeta
      );

      setCurrentSession(
        sessionMeta
      );

      setShowSpreadGrid(false);
      setPendingInput(null);
    } catch (error) {
      console.error(error);

      toast.error(
        error.message ||
          "Something went wrong"
      );
    } finally {
      setIsBackendLoading(false);
    }
  };

  const handleSelectSession =
  async (session) => {

    try {

      setIsBackendLoading(true);

      const data =
        await getConversation(
          session.sessionId
        );

      setCurrentSession(
            session
          );

          setMessages(
            data.messages || []
          );

          setShowResult(true);

          setShowHistory(false);

        } catch (error) {

          console.error(error);

          toast.error(
            "Failed to load session"
          );

        } finally {

          setIsBackendLoading(false);
        }
    };

  const items = [
    {
      label: "Readings",
      bgColor: "rgba(25, 18, 40, 0.82)",
      textColor: "#ffffff",
      links: [
        { label: "Reflection History" },
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

      <ScrollStyle />
        
      <UserProfile
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        username={username}
      />

      <ReadingHistory
        isOpen={showHistory}
        onClose={() =>
          setShowHistory(false)
        }

        onSelectSession={
          handleSelectSession
        }
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
        setMessages([]);
        setRevealedCards([]);
        setShowResult(false);
        setShowChatUI(false);
        setShowSpreadGrid(false);
        setPendingInput(null);
        setIsBackendLoading(false);

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

    {showSpreadGrid && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 18,
          background:
            "rgba(5, 5, 16, 0.68)",
          backdropFilter: "blur(12px)",
        }}
      >
        <TarotSpreadGrid
          requiredCards={requiredCards}
          disabled={isBackendLoading}
          onConfirm={handleSpreadConfirm}
        />
      </div>
    )}

      {showResult && (

        selectedCard?.mode ===
        "daily" ? (

        <DailyResultPanel
          card={revealedCards?.[0]}
          isLoading={isBackendLoading}
          onReflectSubmit={
            handleReflectSubmit
          }
        />

        ) : (

          <TarotResultPanel
            cards={
              revealedCards
            }
          />

        )

      )}

    {showChatUI && !showSpreadGrid && (
       <div
    style={{
      position: "absolute",

      left: "50%",
      bottom: "40px",

      transform:
        "translateX(-50%)",

      width: "900px",

      zIndex: 20,
    }}
  >

    {/* conversation */}
    {showResult && (
      <div
        style={{
          marginBottom: "42px",

          transform:
            "translateY(-40px)",

          maxHeight: "62vh",

          overflowY: "auto",

          paddingRight: "10px",
        }}
      >
        <ChatConversation
          messages={messages}
        />
      </div>
    )}

    {/* input */}
{/* input */}
{!showSpreadGrid && (

  selectedCard?.mode === "daily" ? (

    <DailyChatBox
      disabled={
        isBackendLoading
      }

      onSubmit={
        handleDailySubmit
      }
    />

  ) : (

    <ChatBox
      mode={selectedCard?.mode}

      disabled={
        isBackendLoading
      }

      onSubmitDraft={
        handleChatSubmitDraft
      }
    />

  )

)}

  </div>

    )}

    {isBackendLoading && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "rgba(2, 2, 8, 0.38)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "74px",
            height: "74px",
            borderRadius: "50%",
            border:
              "4px solid rgba(255,255,255,0.16)",
            borderTopColor: "#e879f9",
            boxShadow:
              "0 0 32px rgba(232,121,249,0.35)",
            animation:
              "tarot-loading-spin 0.9s linear infinite",
          }}
        />

        <style>
          {`
            @keyframes tarot-loading-spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
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
