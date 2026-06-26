import CardNav from "../components/layout/CardNav";
import { playScene } from "../components/transition/sceneTransition";
import UserProfile from "../components/ui/UserProfile";
import ReadingHistory from "../components/ui/ReadingHistory";
import ReflectionHistory from "../components/ui/ReflectionHistory";
import MascotHelper from "../components/ui/MascotHelper";
import MarkdownOverlay from "../components/ui/MarkdownOverlay";
import ContactPanel from "../components/ui/ContactPanel";
import SettingsModal from "../components/ui/SettingsModal";
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
import DeepReadingPanel
from "../components/ui/DeepReadingPanel";

import {
  getConversationSafe,
  getReadingHistory,
  getSessionDetail,
  buildSessionMessages,
  getApiErrorMessage,
  resolveSessionId,
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
  useRef,
  useState,
} from "react";

import {
  askTarotQuestion,
  followupSession,
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

import { Undo2, X } from "lucide-react";
import useIsMobile from "../hooks/useIsMobile";
import tarotReading from "../assets/images/homepage/the-magician.png";
import whatIsTarotContent from "../assets/text/what_is_tarot.md?raw";
import catarotContent from "../assets/text/catarot.md?raw";
import guidelineContent from "../assets/text/guideline.md?raw";
import "./HomePage.css";
import { useAppSettings } from "../context/AppSettingsContext";

const READING_SESSION_CARD = {
  image: tarotReading,
  text: "Trải Bài",
  mode: "reading",
};

const MAX_PREVIEW_TITLE_LENGTH = 30;

function truncatePreviewTitle(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= MAX_PREVIEW_TITLE_LENGTH) return text;
  return `${text.slice(0, MAX_PREVIEW_TITLE_LENGTH).trimEnd()}...`;
}

/**
 * Dựng nội dung bong bóng "user" cho trải bài.
 * Khi hỏi bằng giọng nói (chưa gõ chữ), hiển thị transcript nhận diện được để người
 * dùng thấy hệ thống đã "nghe" đúng. Hỏi bằng chữ thì giữ nguyên câu hỏi.
 * @param {string} [question] câu hỏi gõ tay (có thể rỗng)
 * @param {string} [transcript] văn bản ASR từ giọng nói (có thể rỗng/null)
 * @returns {string}
 */
function buildUserMessageContent(question, transcript) {
  const q = (question || "").trim();
  const t = (transcript || "").trim();
  if (q && t && t !== q) return `${q}\n\n🎙️ ${t}`;
  if (q) return q;
  if (t) return `🎙️ ${t}`;
  return "";
}

export default function HomePage() {
  // Cờ mobile (< 768px) — chỉ dùng để rẽ nhánh style, KHÔNG đổi giao diện desktop.
  const isMobile = useIsMobile();
  const { settings, t } = useAppSettings();

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

  // Khoá ĐỒNG BỘ chống double-submit: prop `disabled` của nút cập nhật bất đồng bộ nên 2 cú
  // bấm nhanh có thể lọt 2 request /api/ask (2 phiên, tốn LLM). Ref khoá ngay trong cùng tick.
  const submittingRef = useRef(false);

  // Nhãn loader theo ngữ cảnh: trải bài / mở phiên cũ / tải lá hằng ngày là 3 việc khác nhau,
  // không nên cùng hiện "Đang luận giải...".
  const [loadingLabel, setLoadingLabel] = useState(
    "Đang luận giải lá bài của bạn"
  );

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
  const [showSettings, setShowSettings] = useState(false);
  const [activeMarkdownDoc, setActiveMarkdownDoc] =
    useState(null);

  // Selected Card
  const [selectedCard, setSelectedCard] = useState(null);
  const [hideGallery, setHideGallery] = useState(false);
  const [showChatUI, setShowChatUI] = useState(false);
  const [showSpreadGrid, setShowSpreadGrid] = useState(false);
  const [pendingInput, setPendingInput] = useState(null);
  const [isBackendLoading, setIsBackendLoading] = useState(false);
  const [showDeepReadingPanel, setShowDeepReadingPanel] = useState(false);

  // Zoom-to-fit toàn bộ layout desktop theo CẢ chiều rộng lẫn chiều cao.
  // (CSS cũ chỉ scale theo chiều cao nên màn hẹp bị tràn/cắt lưới bài.)
  // Tham chiếu chiều cao 880 (trước 1024): 1024 cao hơn hầu hết laptop
  // (~720–900px CSS, nhất là Windows scale 125/150%) nên trang luôn bị co
  // ~70–85% → chữ/component nhỏ khó đọc. Hạ về 880 cho trang to hơn ~16%
  // mà lưới bài (cao ~580px) vẫn vừa khung.
  // Lấy hệ số nhỏ nhất giữa 2 trục, không phóng to quá 1 (sàn 0.2 chống lỗi).
  // Trên mobile KHÔNG scale (pageScale = 1) để layout chảy tĩnh, dễ cuộn.
  const computeScale = () => {
    if (typeof window === "undefined") return 1;
    if (isMobile) return 1;
    return Math.max(
      0.2,
      Math.min(window.innerWidth / 1500, window.innerHeight / 880, 1)
    );
  };
  const [pageScale, setPageScale] = useState(computeScale);
  const [hasTodayDailyReading, setHasTodayDailyReading] =
    useState(false);
  const [dailyInfoNote, setDailyInfoNote] =
    useState("");

  // currentSession: phiên hiện tại để HỎI TIẾP (follow-up) trên cùng bài đọc.
  const [currentSession, setCurrentSession] = useState(null);

  // --- Đồng bộ nút Back của TRÌNH DUYỆT với điều hướng nội bộ của HomePage ---
  // HomePage là MỘT route (/home) nhưng có nhiều "màn hình" chạy bằng state (chọn lá/mode,
  // hồ sơ, lịch sử, chiêm nghiệm, liên hệ, tài liệu). Mặc định nút Back của trình duyệt sẽ
  // RỜI khỏi /home và nhảy thẳng về /login. Khối dưới "bẫy" nút Back: khi còn màn hình nội bộ
  // đang mở, Back sẽ đóng lần lượt từng lớp (giống nút quay lại trên giao diện) thay vì thoát /home.

  // Snapshot cờ màn hình vào ref để handler popstate (đăng ký 1 lần/phiên) luôn đọc giá trị mới nhất.
  const screenFlagsRef = useRef(null);
  screenFlagsRef.current = {
    showProfile,
    activeMarkdownDoc,
    showContact,
    showReflectionHistory,
    showHistory,
    selectedCard,
  };

  // Đưa toàn bộ màn trải bài/daily về lại gallery (dùng chung cho nút quay lại trên giao diện
  // và nút Back trình duyệt) — giữ nguyên hành vi cũ của nút <Undo2>.
  const resetReadingToGallery = useCallback(() => {
    setMessages([]);
    setRevealedCards([]);
    setShowResult(false);
    setHasTodayDailyReading(false);
    setDailyInfoNote("");
    setShowChatUI(false);
    setShowSpreadGrid(false);
    setShowDeepReadingPanel(false);
    setPendingInput(null);
    setCurrentSession(null);
    setIsBackendLoading(false);
    setTimeout(() => {
      setSelectedCard(null);
      setHideGallery(false);
    }, 250);
  }, []);

  // Đóng đúng MỘT màn hình trên cùng (ưu tiên overlay trước, rồi tới màn trải bài).
  const closeTopScreen = useCallback(() => {
    const flags = screenFlagsRef.current;
    if (flags.showProfile) return setShowProfile(false);
    if (flags.activeMarkdownDoc) return setActiveMarkdownDoc(null);
    if (flags.showContact) return setShowContact(false);
    if (flags.showReflectionHistory) return setShowReflectionHistory(false);
    if (flags.showHistory) return setShowHistory(false);
    if (flags.selectedCard) return resetReadingToGallery();
  }, [resetReadingToGallery]);

  const anyScreenOpen =
    showProfile ||
    Boolean(activeMarkdownDoc) ||
    showContact ||
    showReflectionHistory ||
    showHistory ||
    Boolean(selectedCard);

  useEffect(() => {
    if (!anyScreenOpen) return undefined;

    // Đẩy 1 "chốt" lịch sử để nút Back có cái để tiêu thụ mà KHÔNG rời khỏi /home.
    window.history.pushState({ __homeScreen: true }, "");
    const armedAt = Date.now();
    let sentinelLive = true; // còn 1 "chốt" của mình đang nằm trong history?
    let closing = false; // màn cuối đang đóng (chờ animation 250ms) → chặn Back lặp gọi đóng 2 lần

    const handlePopState = () => {
      // Bỏ qua popstate phát sinh NGAY sau khi arm: đó là do StrictMode (dev) gọi history.back()
      // trong cleanup giả, KHÔNG phải người dùng bấm Back (không ai bấm được trong <120ms).
      // Dùng mốc THỜI GIAN (không dùng ref-flag) vì ở production cleanup gọi history.back() khi
      // KHÔNG còn listener để tiêu thụ flag → flag sẽ kẹt và nuốt nhầm lần Back thật kế tiếp.
      if (Date.now() - armedAt < 120) return;
      if (closing) return; // đang đóng màn cuối → bỏ qua Back lặp trong lúc chờ state cập nhật

      const flags = screenFlagsRef.current;
      const openCount = [
        flags.showProfile,
        flags.activeMarkdownDoc,
        flags.showContact,
        flags.showReflectionHistory,
        flags.showHistory,
        flags.selectedCard,
      ].filter(Boolean).length;

      sentinelLive = false; // chốt vừa bị nút Back tiêu thụ
      if (openCount === 0) return;
      closeTopScreen();
      if (openCount - 1 > 0) {
        // Vẫn còn lớp khác → đẩy lại chốt để lần Back kế tiếp đóng tiếp từng lớp.
        window.history.pushState({ __homeScreen: true }, "");
        sentinelLive = true;
      } else {
        closing = true; // màn cuối đang đóng (vd defer 250ms) — không gọi đóng lại nữa
      }
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Đóng bằng thao tác TRONG app (không phải Back) → chốt còn treo → gỡ đi để lần Back kế
      // tiếp KHÔNG bị "đơ" (hết dead-press). StrictMode dev được chặn bằng guard `armedAt` ở trên.
      if (sentinelLive && window.history.state?.__homeScreen) {
        window.history.back();
      }
    };
  }, [anyScreenOpen, closeTopScreen]);

  const buildAssistantMessage = (
    content,
    shouldUseSpeech = false
  ) => ({
    role: "assistant",
    content,
    speechPlaybackEnabled: Boolean(
      shouldUseSpeech &&
      settings.speechPlaybackEnabled
    ),
    speechKey:
      shouldUseSpeech &&
      settings.speechPlaybackEnabled
        ? `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`
        : "",
  });

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
    // Tính lại scale theo kích thước cửa sổ; trên mobile luôn = 1.
    const onResize = () =>
      setPageScale(
        isMobile
          ? 1
          : Math.max(
              0.2,
              Math.min(window.innerWidth / 1500, window.innerHeight / 880, 1)
            )
      );
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

  useEffect(() => {
    if (
      selectedCard?.mode !== "daily" ||
      !userProfile
    ) {
      return;
    }

    // Cờ huỷ: nếu user quay lại/đổi mode trong lúc đang tải, KHÔNG ghi đè màn hình bằng
    // kết quả về muộn (tránh panel daily tự nhảy lại sau khi đã rời).
    let isCancelled = false;

    const loadTodayDailyReading =
      async () => {
        try {
          setIsBackendLoading(true);
          setLoadingLabel("Đang tải lá bài hằng ngày…");

          const result =
            await getTodayDailyReadingState(
              userProfile
            );

          if (isCancelled) return;

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
              ...buildAssistantMessage(
                dailyItem.affirmation ||
                  "Lá bài hôm nay của bạn đã đến."
              ),
            },
          ]);

          setRevealedCards([
            dailyItem,
          ]);

          setShowResult(true);
          setShowDeepReadingPanel(false);
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

    return () => {
      isCancelled = true;
    };
  }, [selectedCard?.mode, userProfile]);

  // Khoá cuộn nền khi mở overlay rút bài: chống iOS cuộn xuyên nền (scroll bleed-through)
  // làm trang phía dưới bị lệch khi đóng overlay. touchAction='none' mới chặn rubber-band iOS.
  // Khoá cuộn nền khi mở BẤT KỲ overlay/drawer nào (không chỉ rút bài) → chống iOS cuộn
  // xuyên nền làm trang phía dưới lệch + làm drawer khó đóng cảm giác như hỏng.
  const anyOverlayOpen =
    showSpreadGrid ||
    showProfile ||
    showHistory ||
    showReflectionHistory ||
    showContact ||
    showSettings ||
    Boolean(activeMarkdownDoc);
  useEffect(() => {
    if (!anyOverlayOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [anyOverlayOpen]);

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

          content: mood_pre,
        },

        {
          ...buildAssistantMessage(
            dailyItem?.affirmation ||
              "Lá bài hôm nay của bạn đã đến."
          ),
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
      setShowDeepReadingPanel(false);
      setDailyInfoNote(
        "Hôm nay bạn đã nhận lá bài hằng ngày rồi."
      );

      setShowSpreadGrid(false);
      setCurrentSession(null);

      setShowResult(true);
      setShowDeepReadingPanel(false);

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
    setShowDeepReadingPanel(false);
    setCurrentSession(null);

    // Phát hiệu ứng xoáy; đổi nội dung đúng lúc xoáy che kín màn hình.
    playScene({
      onCover: () => {
        setSelectedCard(card);

        setShowChatUI(
          card.mode !== "duo" &&
          card.mode !== "community" &&
          card.mode !== "visions"
        );
        setShowSpreadGrid(false);
        setPendingInput(null);
      },
    });
  };

const handleChatSubmitDraft =
  async (draft) => {

    const hasImages =
      draft.images?.length > 0;

    // IMAGE MODE
    // -> skip spread grid
    if (hasImages) {

      if (submittingRef.current) return;
      submittingRef.current = true;

      setLoadingLabel("Đang luận giải lá bài của bạn");

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
            content: buildUserMessageContent(
              draft.question,
              response.transcript
            ),
          },

          {
            ...buildAssistantMessage(
              response.final_answer,
              true
            ),
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
          getApiErrorMessage(error)
        );

        // Ném lại để ChatBox KHÔNG xoá câu hỏi/ảnh khi gửi ảnh thất bại.
        throw error;

      } finally {

        setIsBackendLoading(false);
        submittingRef.current = false;
      }

      return;
    }

    // TEXT / AUDIO
    // FOLLOW-UP: đang xem một phiên ĐÃ có kết quả + gõ tiếp (text) → HỎI TIẾP trên CÙNG phiên
    // (gọi /followup) thay vì mở lại màn rút bài. Lượt đọc MỚI thì bắt đầu lại từ gallery.
    const followupSessionId = showResult ? resolveSessionId(currentSession) : null;
    const followupMessage = (draft.question || "").trim();
    if (followupSessionId && followupMessage) {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setLoadingLabel("Đang hỏi tiếp…");
      try {
        setIsBackendLoading(true);
        const data = await followupSession(followupSessionId, followupMessage);
        setMessages((prev) => [
          ...prev,
          { role: "user", content: followupMessage },
          { ...buildAssistantMessage(data.assistant_answer, true) },
        ]);
      } catch (error) {
        console.error(error);
        toast.error(getApiErrorMessage(error));
        throw error; // ném lại để ChatBox giữ lại câu hỏi đã gõ
      } finally {
        setIsBackendLoading(false);
        submittingRef.current = false;
      }
      return;
    }

    // -> lượt đọc MỚI: mở màn rút bài
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

    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoadingLabel(
      selectedCard?.mode === "daily"
        ? "Đang rút lá bài hằng ngày…"
        : "Đang luận giải lá bài của bạn"
    );

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
          ...buildAssistantMessage(
            dailyItem.affirmation ||
              "Lá bài hôm nay của bạn đã đến."
          ),
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
      setShowDeepReadingPanel(false);

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
          content: buildUserMessageContent(
            pendingInput.question,
            response.transcript
          ),
        },

        {
          ...buildAssistantMessage(
            response.final_answer,
            true
          ),
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
      submittingRef.current = false;
    }
  };

  const handleSelectSession =
  async (session) => {

    try {

      setShowHistory(false);
      setIsBackendLoading(true);
      setLoadingLabel("Đang mở lại phiên trải bài…");
      setPendingInput(null);
      setCurrentSession(session);
      setMessages([]);
      setRevealedCards([]);
      openReadingSession(
        session.title
      );
      setShowResult(true);
      setShowDeepReadingPanel(false);

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
      label: t("nav_reading"),
      bgColor: "rgba(25, 18, 40, 0.82)",
      textColor: "#ffffff",
      links: [
        {
          label: t("nav_reflection_history"),
          onClick: () =>
            playScene({
              onCover: () => setShowReflectionHistory(true),
            }),
        },
        { label: t("nav_reading_history"),
          onClick: () => playScene({ onCover: () => setShowHistory(true) }) },
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
            playScene({
              onCover: () =>
                setActiveMarkdownDoc({
                  title: t("overlay_what_is_tarot"),
                  content: whatIsTarotContent,
                }),
            }),
        },
        {
          label: t("nav_catarot"),
          onClick: () =>
            playScene({
              onCover: () =>
                setActiveMarkdownDoc({
                  title: t("overlay_catarot"),
                  content: catarotContent,
                }),
            }),
        },
      ],
    },

    {
      label: t("nav_contact"),
      bgColor: "rgba(30, 16, 50, 0.82)",
      textColor: "#ffffff",
      links: [
        { label: t("nav_more_info"),
          onClick: () => playScene({ onCover: () => setShowContact(true) }),
        },
        // Lối vào Cài đặt + Hướng dẫn cho MOBILE (mascot bị ẩn trên điện thoại nên
        // trước đây không tới được — gồm tắt nhạc nền / âm lượng / đọc TTS).
        { label: t("settings_title"),
          onClick: () => setShowSettings(true),
        },
        { label: t("guide_title"),
          onClick: () =>
            setActiveMarkdownDoc({
              title: t("guide_title"),
              content: guidelineContent,
            }),
        },
      ],
    },
  ];

  return (
    <div
      className={
        isMobile
          ? "home-viewport home-viewport--mobile"
          : "home-viewport"
      }
      style={{
        "--home-page-scale": pageScale,
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

        onButtonClick={() =>
          playScene({ onCover: () => setShowProfile(true) })
        }

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

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
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

    {selectedCard && !showSpreadGrid && (
      <Undo2
      onClick={resetReadingToGallery}
      role="button"
      tabIndex={0}
      aria-label="Quay lại"
      onKeyDown={(e) => {
        // Cho phép quay lại bằng bàn phím (icon Undo2 vốn là svg, không nhận phím sẵn).
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          resetReadingToGallery();
        }
      }}

        size={isMobile ? 28 : 34}

        style={
          isMobile
            ? {
                // Mobile: ghim cố định góc trên trái, không scale theo layout.
                position: "fixed",
                top: "10px",
                left: "10px",
                color: "#f3d0ff",
                cursor: "pointer",
                zIndex: 60,
                transition: "0.25s ease",
                filter:
                  "drop-shadow(0 0 10px rgba(192,132,252,0.45))",
              }
            : {
                position: "absolute",

                top: "50px",
                left: "50px",

                color: "#f3d0ff",

                cursor: "pointer",

                zIndex: 30,

                transition: "0.25s ease",

                filter:
                  "drop-shadow(0 0 10px rgba(192,132,252,0.45))",
              }
        }

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

          // Mobile: bỏ absolute, đưa preview về dòng chảy tĩnh, căn giữa.
          ...(isMobile
            ? {
                position: "static",
                left: "auto",
                top: "auto",
                margin: "76px auto 8px",
                textAlign: "center",
              }
            : null),
        }}
      >
        <img
          src={selectedCard.image}
          alt={selectedCard.text}

          style={{
            width: isMobile ? "115px" : "170px",
            borderRadius: "18px",
          }}
        />

        <div
          style={{
            marginTop: "12px",

            width: isMobile ? "100%" : "170px",

            textAlign: "center",

            color: "#fff",

            fontSize: isMobile ? "1.18rem" : "1.32rem",
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {truncatePreviewTitle(selectedCard.text)}
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

          // Mobile: panel chảy tĩnh, full chiều ngang.
          ...(isMobile
            ? {
                position: "static",
                transform: "none",
                left: "auto",
                top: "auto",
                width: "100%",
                maxWidth: "100%",
                padding: "80px 10px 24px",
                boxSizing: "border-box",
              }
            : null),
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

          // Mobile: panel chảy tĩnh, full chiều ngang.
          ...(isMobile
            ? {
                position: "static",
                transform: "none",
                left: "auto",
                top: "auto",
                width: "100%",
                maxWidth: "100%",
                padding: "80px 10px 24px",
                boxSizing: "border-box",
              }
            : null),
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

          // Mobile: panel chảy tĩnh, full chiều ngang.
          ...(isMobile
            ? {
                position: "static",
                transform: "none",
                left: "auto",
                top: "auto",
                width: "100%",
                maxWidth: "100%",
                padding: "80px 10px 24px",
                boxSizing: "border-box",
              }
            : null),
        }}
      >
        <VisionsVaultPanel />
      </div>
    )}

    {showSpreadGrid && (
      <div
        style={{
          // Overlay phủ TOÀN màn hình + cho CUỘN DỌC (cả desktop lẫn mobile) để luôn thấy
          // nút "Xác nhận" khi lưới bài cao hơn viewport. Trước đây desktop dùng position
          // absolute + overflow mặc định → nút bị đẩy xuống dưới đáy, không cuộn tới được.
          position: "fixed",
          inset: 0,
          zIndex: 18,
          background: "rgba(5, 5, 16, 0.68)",
          backdropFilter: "blur(12px)",
          overflowY: "auto",
        }}
      >
        {/* Nút Huỷ rõ ràng (thay cho nút back bị ẩn khi mở overlay) → không bấm nhầm mất lựa chọn. */}
        <button
          type="button"
          onClick={resetReadingToGallery}
          aria-label="Huỷ rút bài"
          style={{
            position: "fixed",
            top: isMobile ? "10px" : "24px",
            left: isMobile ? "10px" : "24px",
            zIndex: 25,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: isMobile ? "8px 14px" : "10px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(20,10,35,0.72)",
            backdropFilter: "blur(6px)",
            color: "#f3d0ff",
            fontSize: isMobile ? "0.85rem" : "0.92rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <X size={isMobile ? 16 : 18} /> Huỷ
        </button>

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

        <>
        <DailyResultPanel
          card={revealedCards?.[0]}
          isLoading={isBackendLoading}
          infoNote={dailyInfoNote}
          onOpenDeepReading={() =>
            setShowDeepReadingPanel(true)
          }
          onReflectSubmit={
            handleReflectSubmit
          }
        />
        </>

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

      // Mobile: ô nhập GHIM CỐ ĐỊNH đáy màn (fixed) để LUÔN thấy ngay khi mở Trải Bài.
      // Trước dùng sticky → khi nội dung ngắn, ô nhập không được kéo lên đáy mà nằm khuất
      // dưới fold, phải cuộn mới thấy → tưởng app bị đơ.
      ...(isMobile
        ? {
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            transform: "none",
            width: "100%",
            maxWidth: "100%",
            padding: "8px 10px calc(10px + env(safe-area-inset-bottom, 0px))",
            boxSizing: "border-box",
            zIndex: 30,
            background:
              "linear-gradient(to top, rgba(5,5,16,0.97) 62%, rgba(5,5,16,0))",
          }
        : null),
    }}
  >

    {/* conversation */}
    {showResult && selectedCard?.mode !== "daily" && (
      <div
        style={{
          marginBottom: "26px",

          transform:
            "translateY(-68px)",

          maxHeight: "70vh",

          overflowY: "auto",

          paddingRight: "10px",

          // Mobile: bỏ giới hạn chiều cao + dịch chuyển để hội thoại chảy tự nhiên.
          ...(isMobile
            ? {
                maxHeight: "calc(100dvh - 210px)",
                overflowY: "auto",
                transform: "none",
                marginBottom: "10px",
              }
            : null),
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

    {selectedCard?.mode === "daily" && (
      <DeepReadingPanel
        card={revealedCards?.[0]}
        isOpen={showDeepReadingPanel}
        onClose={() =>
          setShowDeepReadingPanel(false)
        }
      />
    )}

    {isBackendLoading && <MysticLoader label={loadingLabel} />}

      {/* stars */}
      <div
        style={{
          position: isMobile ? "fixed" : "absolute",
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
