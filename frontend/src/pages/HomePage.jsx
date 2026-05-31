import CardNav from "../components/layout/CardNav";
import UserProfile from "../components/ui/UserProfile";
import ReadingHistory from "../components/ui/ReadingHistory";
import ReflectionHistory from "../components/ui/ReflectionHistory";
import MascotHelper from "../components/ui/MascotHelper";
import MarkdownOverlay from "../components/ui/MarkdownOverlay";
import ContactPanel from "../components/ui/ContactPanel";
// import TarotGallery from "../components/ui/TarotGallery";
import TarotGallery from "../components/ui/StaticTarotGallery";
import DuoReadingPanel from "../components/ui/DuoReadingPanel";
import CommunityReadingPanel from "../components/ui/CommunityReadingPanel";
import VisionsVaultPanel from "../components/ui/VisionsVaultPanel";
import ChatBox from "../components/ui/ChatBox";
import TarotSpreadGrid from "../components/ui/TarotSpreadGrid";

import DailyChatBox
from "../components/ui/DailyChatBox";

import DailyResultPanel
from "../components/ui/DailyResultPanel";

import {
  getConversationSafe,
  getReadingHistory,
  getSessionDetail,
  buildSessionMessages,
  getApiErrorMessage,
} from "../services/historyService";

import {
  saveSessionMeta,
} from "../services/sessionCache";

import ScrollStyle
from "../components/common/Scroll";

import TarotResultPanel
from "../components/ui/TarotResultPanel";
import MysticLoader from "../components/ui/MysticLoader";

import ChatConversation
from "../components/ui/ChatConversation";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  askTarotQuestion,
} from "../services/tarotService";
import {
  getCurrentUser,
} from "../services/authService";

import {
  askDailyQuestion,
  cacheTodayDailyCard,
  getDailyHistory,
  getTodayDailyReadingState,
} 

from "../services/dailyService";

  import {
  reflectDailyCard
}

from "../services/dailyService";

import toast from "react-hot-toast";

import { Undo2 } from "lucide-react";
import tarotReading from "../assets/images/homepage/the-magician.png";
import whatIsTarotContent from "../assets/text/what_is_tarot.md?raw";
import catarotContent from "../assets/text/catarot.md?raw";
import "./HomePage.css";

const READING_SESSION_CARD = {
  image: tarotReading,
  text: "Trải Bài",
  mode: "reading",
};

export default function HomePage() {
  const getStoredUser =
    () => {
      try {
        for (const storage of [
          localStorage,
          sessionStorage,
        ]) {
          const raw =
            storage.getItem("user");
          if (!raw) continue;
          return JSON.parse(raw);
        }
      } catch (error) {
        console.warn(
          "Failed to parse stored user",
          error
        );
      }

      return null;
    };

  const persistUserProfile =
    (profile) => {
      const serialized =
        JSON.stringify(profile);

      localStorage.setItem(
        "user",
        serialized
      );

      sessionStorage.setItem(
        "user",
        serialized
      );
    };

  const [userProfile, setUserProfile] =
    useState(
      getStoredUser()
    );

  const [messages, setMessages] =
  useState([]);

  const [revealedCards, setRevealedCards] =
    useState([]);

  const [showResult, setShowResult] =
    useState(false);

  const [isToastVisible, setIsToastVisible] = useState(false);

  const [showProfile, setShowProfile] = useState(false);

  const username =
    userProfile?.display_name ||
    userProfile?.username ||
    "Bạn";

  // Reading History
  const [showHistory, setShowHistory] = useState(false);
  const [showReflectionHistory, setShowReflectionHistory] =
    useState(false);
  const [reflectionHistoryVersion, setReflectionHistoryVersion] =
    useState(0);
  const [readingHistoryVersion, setReadingHistoryVersion] =
    useState(0);

  // Contact Panel
  const [showContact, setShowContact] = useState(false);
  const [activeMarkdownDoc, setActiveMarkdownDoc] =
    useState(null);

  // Selected Card
  const [selectedCard, setSelectedCard] = useState(null);
  const [hideGallery, setHideGallery] = useState(false);
  const [showChatUI, setShowChatUI] = useState(false);
  const [showSpreadGrid, setShowSpreadGrid] = useState(false);
  const [pendingInput, setPendingInput] = useState(null);
  const [isBackendLoading, setIsBackendLoading] = useState(false);
  const [hasTodayDailyReading, setHasTodayDailyReading] =
    useState(false);
  const [dailyInfoNote, setDailyInfoNote] =
    useState("");

  // eslint-disable-next-line no-unused-vars -- TODO: hook up session reuse
  const [currentSession, setCurrentSession] = useState(null);

  const requiredCards =
    selectedCard?.mode === "daily" ? 1 : 3;

  const openReadingSession = (
    title = READING_SESSION_CARD.text
  ) => {
    setSelectedCard({
      ...READING_SESSION_CARD,
      text: title,
    });
    setHideGallery(true);
    setShowChatUI(true);
    setShowSpreadGrid(false);
  };

  const loadReadingHistory =
    useCallback(async () => {
      const sessions =
        await getReadingHistory();

      return sessions;
    }, []);

  useEffect(() => {
    const loadUserProfile =
      async () => {
        try {
          const profile =
            await getCurrentUser();

          setUserProfile(
            profile
          );
          persistUserProfile(
            profile
          );
          setReadingHistoryVersion(
            (prev) => prev + 1
          );
          await loadReadingHistory();
        } catch (error) {
          console.error(
            "Failed to load current user profile",
            {
              message:
                error?.message,
              detail:
                error?.response?.data
                  ?.detail,
              status:
                error?.response?.status,
            }
          );
        }
      };

    loadUserProfile();
  }, [loadReadingHistory]);

  useEffect(() => {
    if (
      selectedCard?.mode !== "daily" ||
      !userProfile
    ) {
      return;
    }

    const loadTodayDailyReading =
      async () => {
        try {
          setIsBackendLoading(true);

          const result =
            await getTodayDailyReadingState(
              userProfile
            );

          if (!result?.hasTodayReading || !result?.item) {
            setHasTodayDailyReading(false);
            setDailyInfoNote("");
            return;
          }

          const dailyItem =
            result.item;

          setHasTodayDailyReading(true);
          setDailyInfoNote(
            "Hôm nay bạn đã nhận lá bài hằng ngày rồi."
          );

          setMessages([
            {
              role: "user",
              content:
                dailyItem.question ||
                dailyItem.mood_pre ||
                "Tarot Hằng Ngày",
            },
            {
              role: "assistant",
              content:
                dailyItem.affirmation ||
                "Lá bài hôm nay của bạn đã đến.",
            },
          ]);

          setRevealedCards([
            dailyItem,
          ]);

          setShowResult(true);
          setShowSpreadGrid(false);
          setPendingInput(null);
        } catch (error) {
          console.error(
            "Failed to load today's daily reading",
            error
          );
          setHasTodayDailyReading(false);
          setDailyInfoNote("");
        } finally {
          setIsBackendLoading(false);
        }
      };

    loadTodayDailyReading();
  }, [selectedCard?.mode, userProfile]);

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
        "Đã lưu chiêm nghiệm"
      );

      setReflectionHistoryVersion(
        (prev) => prev + 1
      );

    } catch (error) {

      console.error(error);

      toast.error(
        error.message ||
        "Lưu chiêm nghiệm thất bại"
      );
    }
};

  const handleDailySubmit =
  async ({
    mood_pre,
    question,
  }) => {
    if (hasTodayDailyReading) {
      toast.error(
        "Hôm nay bạn đã nhận lá bài hằng ngày rồi."
      );
      return;
    }

    try {

      setIsBackendLoading(true);

      const response =
        await askDailyQuestion({
          mood_pre,
          question,
        });

      const dailyItem =
        response?.item;

      if (!dailyItem) {

        toast.error(
          "Không nhận được lá bài hằng ngày"
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
            || "Lá bài hôm nay của bạn đã đến.",
        },
      ]);

      setRevealedCards([
        dailyItem,
      ]);
      cacheTodayDailyCard(
        userProfile,
        dailyItem
      );
      setHasTodayDailyReading(
        true
      );
      setDailyInfoNote(
        "Hôm nay bạn đã nhận lá bài hằng ngày rồi."
      );

      setShowSpreadGrid(false);
      setCurrentSession(null);

      setShowResult(true);

      toast.success(
        response.alreadyDrawn
          ? "Lá bài hôm nay đã tồn tại"
          : "Đã rút lá bài hằng ngày"
      );

    } catch (error) {

      console.error(error);

      toast.error(
        error.message ||
        "Rút lá bài hằng ngày thất bại"
      );

    } finally {

      setIsBackendLoading(false);
    }
};
  const handleCardClick = (card) => {

    // feature chưa làm
   if (
      card.mode !== "daily" &&
      card.mode !== "reading" &&
      card.mode !== "duo" &&
      card.mode !== "community" &&
      card.mode !== "visions"
    ) {

      if (!isToastVisible) {

        setIsToastVisible(true);

        toast.error(
          "Tính năng này đang được phát triển.",
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
    setMessages([]);
    setRevealedCards([]);
    setShowResult(false);
    setHasTodayDailyReading(false);
    setDailyInfoNote("");
    setShowSpreadGrid(false);
    setPendingInput(null);
    setShowChatUI(false);
    setCurrentSession(null);

    setTimeout(() => {

      setSelectedCard(card);

      setShowChatUI(
        card.mode !== "duo" &&
        card.mode !== "community" &&
        card.mode !== "visions"
      );
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
            "Trải bài chưa đặt tên",

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
        setReadingHistoryVersion(
          (prev) => prev + 1
        );

        toast.success(
          "Đã hoàn tất trải bài"
        );

      } catch (error) {

        console.error(error);

        toast.error(
          "Đã có lỗi xảy ra"
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
        `Vui lòng chọn ${requiredCards} lá bài trước khi tiếp tục.`
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

        const dailyItem =
          response?.item;

        if (!dailyItem) {
          toast.error(
            "Không nhận được lá bài hằng ngày"
          );
          return;
        }

        setMessages([
        {
          role: "user",
          content:
            pendingInput.question,
        },

        {
          role: "assistant",
          content:
            dailyItem.affirmation ||
            "Lá bài hôm nay của bạn đã đến.",
        },
      ]);

      setRevealedCards([
        dailyItem,
      ]);
      cacheTodayDailyCard(
        userProfile,
        dailyItem
      );
      setHasTodayDailyReading(
        true
      );
      setDailyInfoNote(
        "Hôm nay bạn đã nhận lá bài hằng ngày rồi."
      );

      setCurrentSession(null);

      setShowResult(true);

        toast.success(
          response.alreadyDrawn
            ? "Hôm nay đã rút lá bài rồi"
            : "Đã rút lá bài hằng ngày"
        );
      } else {
        response = await askTarotQuestion({
          question: pendingInput.question,
          images: pendingInput.images,
          audio: pendingInput.audio,
          selectedCards,
        });

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

        toast.success("Đã hoàn tất trải bài");
      }

      const sessionMeta = {
        sessionId:
          response.session_id,

        title:
          pendingInput.question ||
          "Trải bài chưa đặt tên",

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
      setReadingHistoryVersion(
        (prev) => prev + 1
      );

      setShowSpreadGrid(false);
      setPendingInput(null);
    } catch (error) {
      console.error(error);

      toast.error(
        error.message ||
          "Đã có lỗi xảy ra"
      );
    } finally {
      setIsBackendLoading(false);
    }
  };

  const handleSelectSession =
  async (session) => {

    try {

      setShowHistory(false);
      setIsBackendLoading(true);
      setPendingInput(null);
      setCurrentSession(session);
      setMessages([]);
      setRevealedCards([]);
      openReadingSession(
        session.title
      );
      setShowResult(true);

      const [
        sessionDetail,
        conversation,
      ] = await Promise.all([
        getSessionDetail(
          session
        ),
        getConversationSafe(
          session
        ),
      ]);

      setCurrentSession(
        {
          ...session,
          title:
            sessionDetail.title,
        }
      );

      setMessages(
        buildSessionMessages(
          sessionDetail,
          conversation
        )
      );

      setRevealedCards(
        sessionDetail.cards || []
      );

      openReadingSession(
        sessionDetail.title
      );

        } catch (error) {

          console.error(error);

          toast.error(
            `Không tải được phiên: ${getApiErrorMessage(error)}`
          );

        } finally {

          setIsBackendLoading(false);
        }
    };

  const items = [
    {
      label: "Xem Bài",
      bgColor: "rgba(25, 18, 40, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: "Lịch sử chiêm nghiệm",
          onClick: () =>
            setShowReflectionHistory(
              true
            ),
        },
        { label: "Lịch sử trải bài",
          onClick: () => setShowHistory(true) },
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
        { label: "Thông tin thêm",
          onClick: () => { setShowContact(true);

          } 
        },
      ],
    },
  ];

  return (
    <div
      className="home-viewport"
      style={{
        background: `
          radial-gradient(circle at top left, rgba(168,85,247,0.18), transparent 30%),
          radial-gradient(circle at top right, rgba(236,72,153,0.12), transparent 25%),
          linear-gradient(to bottom, #050510, #090114, #020205)
        `,
      }}
    >

      {/* NAVBAR */}
      <CardNav
        logo=""
        items={items}

        buttonLabel={username || "Bạn"}

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
        user={userProfile}
      />

      <ReadingHistory
        isOpen={showHistory}
        onClose={() =>
          setShowHistory(false)
        }
        loadHistory={
          loadReadingHistory
        }
        refreshKey={
          readingHistoryVersion
        }
        onSelectSession={
          handleSelectSession
        }
      />

      <ReflectionHistory
        isOpen={showReflectionHistory}
        onClose={() =>
          setShowReflectionHistory(
            false
          )
        }
        refreshKey={
          reflectionHistoryVersion
        }
        loadHistory={() =>
          getDailyHistory({
            limit: 30,
          })
        }
      />

      <MascotHelper />

      <ContactPanel
        isOpen={showContact}

        onClose={() => {
          setShowContact(false);
        }}
      />

      <MarkdownOverlay
        isOpen={
          Boolean(
            activeMarkdownDoc
          )
        }
        title={
          activeMarkdownDoc?.title
        }
        content={
          activeMarkdownDoc?.content
        }
        onClose={() =>
          setActiveMarkdownDoc(
            null
          )
        }
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
        setHasTodayDailyReading(false);
        setDailyInfoNote("");
        setShowChatUI(false);
        setShowSpreadGrid(false);
        setPendingInput(null);
        setCurrentSession(null);
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
  

   {(showChatUI ||
      selectedCard?.mode === "duo" ||
      selectedCard?.mode === "community" ||
      selectedCard?.mode === "visions") && selectedCard && (
      <div
        style={{
          position: "absolute",

          left: "70px",
          top: "110px",

          opacity:
            showChatUI ||
            selectedCard?.mode === "duo" ||
            selectedCard?.mode === "community" ||
            selectedCard?.mode === "visions"
              ? 1
              : 0,

          transform:
            showChatUI ||
            selectedCard?.mode === "duo" ||
            selectedCard?.mode === "community" ||
            selectedCard?.mode === "visions"
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

    {selectedCard?.mode === "duo" && (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform:
            "translate(-50%, -50%)",
          width: "min(980px, calc(100vw - 180px))",
          maxWidth: "100%",
          zIndex: 20,
        }}
      >
        <DuoReadingPanel />
      </div>
    )}

    {selectedCard?.mode === "community" && (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform:
            "translate(-50%, -50%)",
          width: "min(1180px, calc(100vw - 180px))",
          maxWidth: "100%",
          zIndex: 20,
        }}
      >
        <CommunityReadingPanel />
      </div>
    )}

    {selectedCard?.mode === "visions" && (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform:
            "translate(-50%, -50%)",
          width: "min(1160px, calc(100vw - 180px))",
          maxWidth: "100%",
          zIndex: 20,
        }}
      >
        <VisionsVaultPanel />
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
          infoNote={dailyInfoNote}
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
    !hasTodayDailyReading && (
      <DailyChatBox
        disabled={
          isBackendLoading
        }

        onSubmit={
          handleDailySubmit
        }
      />
    )

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

    {isBackendLoading && <MysticLoader />}

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
