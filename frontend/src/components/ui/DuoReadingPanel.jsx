import "./DuoReadingPanel.css";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  RefreshCw,
  SquareArrowRightExit,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  createDuoSession,
  getDuoSession,
  joinDuoByInvite,
  uploadDuoCard,
} from "../../services/duoService";
import MysticLoader from "./MysticLoader";
import SpeechPlaybackMessage from "./SpeechPlaybackMessage";

const ACTIVE_DUO_SESSION_KEY = "active_duo_session_id";

const getErrorMessage = (error) =>
  error?.response?.data?.detail ||
  error?.message ||
  "Đã có lỗi xảy ra";

const getStoredUser = () => {
  try {
    const raw =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getParticipantCard = (session, participantId) =>
  session?.cards?.find(
    (card) => card.participant_id === participantId
  ) || null;

const formatCardLabel = (card) => {
  if (!card) return "Đang chờ tải lên";

  const base = `${card.card_name} (${card.orientation})`;
  const confidence = Number(card.confidence);

  if (Number.isFinite(confidence) && confidence > 0) {
    return `${base} · độ tin cậy ${Math.round(confidence * 100)}%`;
  }

  return base;
};

const getStatusMessage = (session) => {
  const status = session?.status;
  const cardsCount =
    session?.cards?.length || 0;

  if (status === "waiting_partner") {
    return "Đang chờ bạn đồng hành tham gia...";
  }

  if (status === "waiting_cards") {
    if (cardsCount === 0) {
      return "Cả hai người cần tải lên lá bài của mình.";
    }

    if (cardsCount === 1) {
      return "Đang chờ lá bài còn lại...";
    }

    return "Cả hai người cần tải lên lá bài của mình.";
  }

  if (status === "generating") {
    return "Đang tạo trải bài chung...";
  }

  if (status === "completed") {
    return "Đã hoàn tất trải bài chung.";
  }

  if (status === "failed") {
    return "Trải Bài Đôi thất bại. Vui lòng thử lại.";
  }

  return "Đã tạo phòng.";
};

const stripReferenceSection = (content) =>
  String(content ?? "")
    .replace(
      /\n{0,2}(?:#{1,6}\s*)?(?:Tư liệu tham khảo|Tài liệu tham khảo|Tham khảo|References?)\s*\n[\s\S]*$/i,
      ""
    )
    .trim();

const formatJoinedAt = (value) => {
  if (!value) return "Đã tham gia";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const getParticipantName = (
  participant,
  storedUser
) => {
  if (!participant) return "Bạn đồng hành";

  // Người đang đăng nhập luôn hiển thị "Bạn" cho rõ ràng. Trước đây ô này hiện
  // display_name — mà với tài khoản không đặt tên đăng nhập, display_name mặc
  // định là phần đầu email (vd "24520131"), khiến tên trông như bị lỗi.
  if (
    storedUser?.id != null &&
    participant.user_id === storedUser.id
  ) {
    return "Bạn";
  }

  // Người còn lại: ưu tiên tên hiển thị / tên đăng nhập thật. KHÔNG fallback ra
  // email thô (vừa xấu vừa lộ thông tin); nếu không có thì dùng nhãn trung lập.
  const partnerName =
    participant.display_name ||
    participant.displayName ||
    participant.username ||
    participant.user_name ||
    participant.name ||
    participant.user?.display_name ||
    participant.user?.username;

  if (partnerName) return partnerName;

  return participant.slot_label
    ? `Người chơi ${participant.slot_label}`
    : "Bạn đồng hành";
};

export default function DuoReadingPanel() {
  const fileInputRef = useRef(null);

  const [view, setView] = useState("landing");
  const [inviteCode, setInviteCode] = useState("");
  const [duoSession, setDuoSession] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedResult, setCopiedResult] = useState(false);
  const [replaySignal, setReplaySignal] = useState(0);
  const [pollStalled, setPollStalled] = useState(false);
  const pollCountRef = useRef(0);

  const storedUser = useMemo(
    () => getStoredUser(),
    []
  );

  const currentUserId = storedUser?.id ?? null;

  const participants =
    duoSession?.participants || [];

  const currentUserParticipant =
    participants.find(
      (participant) =>
        participant.user_id === currentUserId
    ) || null;

  const currentUserCard =
    currentUserParticipant
      ? getParticipantCard(
          duoSession,
          currentUserParticipant.id
        )
      : null;

  const canUploadCard =
    !currentUserCard;
  const cardsCount =
    duoSession?.cards?.length || 0;
  const hasBothParticipants =
    participants.length === 2;
  const hasBothCards =
    hasBothParticipants &&
    cardsCount === 2;
  const showDuoGeneratingOverlay =
    view === "room" &&
    hasBothCards &&
    duoSession?.status !== "completed" &&
    duoSession?.status !== "failed";
  const showFloatingResultSidebar =
    view === "room" &&
    duoSession?.status === "completed" &&
    duoSession?.reading?.generated_text;

  const isOwner =
    currentUserId !== null &&
    currentUserId ===
      duoSession?.owner_user_id;
  const duoReadingText = stripReferenceSection(
    duoSession?.reading?.generated_text
  );
  const duoSpeechKey =
    duoSession?.id && duoReadingText
      ? `duo-${duoSession.id}-${duoReadingText.length}`
      : "";

  const persistSession = (session) => {
    if (!session?.id) return;

    localStorage.setItem(
      ACTIVE_DUO_SESSION_KEY,
      String(session.id)
    );

    setDuoSession(session);
  };

  const clearSelectedImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImage(null);
    setPreviewUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const restoreRoom = async () => {
      const cachedId = localStorage.getItem(
        ACTIVE_DUO_SESSION_KEY
      );

      if (!cachedId) return;

      try {
        setLoading(true);
        setError("");

        const payload = await getDuoSession(cachedId);

        setDuoSession(payload);
        setView("room");
      } catch (err) {
        const status = err?.response?.status;

        if (status === 403 || status === 404) {
          localStorage.removeItem(
            ACTIVE_DUO_SESSION_KEY
          );
          setDuoSession(null);
          setView("landing");
        } else {
          setError(getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    };

    restoreRoom();
  }, []);

  useEffect(() => {
    if (
      view !== "room" ||
      !duoSession?.id
    ) {
      return undefined;
    }

    if (
      duoSession.status ===
      "completed"
    ) {
      return undefined;
    }

    // Mỗi lần (re)start poll: reset bộ đếm + cờ treo.
    pollCountRef.current = 0;
    setPollStalled(false);

    // Sinh trải bài chung là đồng bộ (vài giây); nếu poll quá ngưỡng (~90s) coi như backend
    // treo → DỪNG poll vô hạn + báo người dùng thay vì để dòng "Đang tạo..." xoay mãi.
    const MAX_POLLS = 45;

    const intervalId =
      window.setInterval(
        async () => {
          pollCountRef.current += 1;
          if (pollCountRef.current > MAX_POLLS) {
            window.clearInterval(intervalId);
            setPollStalled(true);
            return;
          }
          try {
            const payload =
              await getDuoSession(
                duoSession.id
              );
            // Chống đua: KHÔNG để snapshot poll CŨ ghi đè state MỚI hơn (vd vừa upload lá xong
            // làm card chớp tắt). So updated_at — chỉ cập nhật nếu payload mới hơn (hoặc thiếu mốc).
            setDuoSession((prev) => {
              const prevTs = prev?.updated_at;
              const nextTs = payload?.updated_at;
              if (prevTs && nextTs && nextTs < prevTs) return prev;
              return payload;
            });
          } catch (err) {
            console.warn(
              "Duo polling failed",
              {
                message:
                  getErrorMessage(err),
                status:
                  err?.response
                    ?.status,
              }
            );
          }
        },
        2000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [
    duoSession?.id,
    duoSession?.status,
    view,
  ]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError("");

      const payload = await createDuoSession();

      persistSession(payload);
      clearSelectedImage();
      setView("room");
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByInvite = async () => {
    try {
      setLoading(true);
      setError("");

      const payload = await joinDuoByInvite(
        inviteCode.trim()
      );

      persistSession(payload);
      clearSelectedImage();
      setView("room");
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!duoSession?.id) return;

    try {
      setLoading(true);
      setError("");

      const payload = await getDuoSession(
        duoSession.id
      );

      persistSession(payload);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelected = (file) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setSelectedImage(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadCard = async () => {
    if (!duoSession?.id || !selectedImage) return;

    try {
      setLoading(true);
      setError("");

      const payload = await uploadDuoCard(
        duoSession.id,
        selectedImage
      );

      persistSession(payload);
      clearSelectedImage();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadMyCard =
    async () => {
    if (participants.length < 2) {
      toast.error("Đang chờ bạn đồng hành tham gia.");
      return;
    }

    if (currentUserCard) {
      toast.error("Bạn đã tải lên một lá bài rồi.");
      return;
    }

    if (!selectedImage) {
      toast.error("Vui lòng chọn ảnh lá bài trước.");
      return;
    }

    await handleUploadCard();
  };

  const handleCopyInviteCode = async () => {
    const code = duoSession?.invite_code || "";

    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      toast.success("Đã sao chép mã mời");
    } catch {
      toast.error("Sao chép mã mời thất bại");
    }
  };

  const handleLeaveRoom = () => {
    localStorage.removeItem(ACTIVE_DUO_SESSION_KEY);

    setDuoSession(null);
    setInviteCode("");
    setError("");
    clearSelectedImage();
    setView("landing");
  };

  const handleCopyReadingResult = async () => {
    if (!duoReadingText) return;

    try {
      await navigator.clipboard.writeText(
        duoReadingText
      );
      setCopiedResult(true);
      window.setTimeout(() => {
        setCopiedResult(false);
      }, 1500);
      toast.success("Đã sao chép kết quả");
    } catch {
      toast.error("Sao chép kết quả thất bại");
    }
  };

  const renderLanding = () => (
    <div className="duo-reading-panel__actions duo-reading-panel__actions--center">
      <button
        type="button"
        className="duo-reading-panel__button duo-reading-panel__button--primary"
        onClick={handleCreateRoom}
        disabled={loading}
      >
        {loading ? "Đang tạo..." : "Tạo Phòng Đôi"}
      </button>

      <button
        type="button"
        className="duo-reading-panel__button duo-reading-panel__button--ghost"
        onClick={() => {
          setError("");
          setView("joining");
        }}
        disabled={loading}
      >
        Tham Gia Bằng Mã Mời
      </button>
    </div>
  );

  const renderJoining = () => (
    <div className="duo-reading-panel__join-box">
      <label className="duo-reading-panel__field-label">
        Mã mời
      </label>

      <input
        type="text"
        className="duo-reading-panel__input"
        value={inviteCode}
        onChange={(e) =>
          setInviteCode(e.target.value.toUpperCase())
        }
        placeholder="AB12CD34"
      />

      <div className="duo-reading-panel__actions">
        <button
          type="button"
          className="duo-reading-panel__button duo-reading-panel__button--primary"
          onClick={handleJoinByInvite}
          disabled={loading || !inviteCode.trim()}
        >
          {loading ? "Đang tham gia..." : "Tham gia"}
        </button>

        <button
          type="button"
          className="duo-reading-panel__button duo-reading-panel__button--ghost"
          onClick={() => {
            setError("");
            setInviteCode("");
            setView("landing");
          }}
          disabled={loading}
        >
          Quay lại
        </button>
      </div>
    </div>
  );

  const renderResultSidebar = () => (
    <aside className="duo-reading-panel__floating-sidebar">
      <div className="duo-reading-panel__floating-sidebar-card">
        <div className="duo-reading-panel__result">
          <div className="duo-reading-panel__result-header">
            <div className="duo-reading-panel__field-label duo-reading-panel__field-label--tight">
              Kết quả Trải Bài Đôi
            </div>

            <div className="duo-reading-panel__result-actions">
              <button
                type="button"
                className="duo-reading-panel__icon-button"
                title="Đọc kết quả"
                onClick={() =>
                  setReplaySignal(
                    (prev) => prev + 1
                  )
                }
              >
                <Volume2 size={18} />
              </button>

              <button
                type="button"
                className="duo-reading-panel__icon-button"
                title="Sao chép kết quả"
                onClick={handleCopyReadingResult}
              >
                {copiedResult ? (
                  <Check size={18} />
                ) : (
                  <Copy size={18} />
                )}
              </button>
            </div>
          </div>

          <div className="duo-reading-panel__result-text">
            <SpeechPlaybackMessage
              text={duoReadingText}
              autoPlay
              speechKey={duoSpeechKey}
              replaySignal={replaySignal}
            />
          </div>
        </div>
      </div>
    </aside>
  );

  const renderRoom = () => (
    <>
      <div className="duo-reading-panel__room-header">
        <div className="duo-reading-panel__invite-card">
          <div>
            <div className="duo-reading-panel__meta-title">
              Mã mời
            </div>

            <div className="duo-reading-panel__meta-value">
              {duoSession?.invite_code || "N/A"}
            </div>
          </div>

          <button
            type="button"
            className="duo-reading-panel__copy-button"
            onClick={handleCopyInviteCode}
            title="Sao chép mã mời"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className="duo-reading-panel__header-actions">
          <button
            type="button"
            className="duo-reading-panel__icon-button"
            onClick={handleRefresh}
            disabled={loading}
            title="Làm mới phòng"
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="duo-reading-panel__icon-button duo-reading-panel__icon-button--danger"
            title="Rời phòng"
            onClick={handleLeaveRoom}
          >
            <SquareArrowRightExit size={18} />
          </button>
        </div>
      </div>

      <div className="duo-reading-panel__status-note">
        {getStatusMessage(duoSession)}
      </div>

      {pollStalled && (
        <div
          role="alert"
          style={{
            marginTop: "8px",
            fontSize: "0.85rem",
            color: "#fecaca",
          }}
        >
          Quá lâu chưa có kết quả. Thử bấm làm mới, hoặc rời phòng rồi tạo lại.
        </div>
      )}

        <div className="duo-reading-panel__section">
          <div className="duo-reading-panel__field-label">
            Người tham gia
          </div>

          <div className="duo-reading-panel__slots">
            {["A", "B"].map(
              (slotLabel) => {
                const participant =
                  participants.find(
                    (item) =>
                      item.slot_label ===
                      slotLabel
                  ) || null;

                const card =
                  participant
                    ? getParticipantCard(
                        duoSession,
                        participant.id
                      )
                    : null;

                return (
                  <div
                    key={slotLabel}
                    className="duo-reading-panel__slot"
                  >
                    <div className="duo-reading-panel__slot-title">
                      {participant
                        ? getParticipantName(
                            participant,
                            storedUser
                          )
                        : `Người tham gia ${slotLabel}`}
                    </div>

                    <div className="duo-reading-panel__slot-meta">
                      <div>
                        Tham gia:{" "}
                        {participant
                          ? formatJoinedAt(
                              participant.joined_at
                            )
                          : "Đang chờ bạn đồng hành..."}
                      </div>

                      <div>
                        Lá bài:{" "}
                        {participant
                          ? formatCardLabel(card)
                          : "Đang chờ bạn đồng hành..."}
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>

        <div className="duo-reading-panel__section">
          <div className="duo-reading-panel__field-label">
            Tải lên lá bài
          </div>

          {canUploadCard ? (
            <>
              <div className="duo-reading-panel__upload-row">
                <input
                  id="duo-card-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) =>
                    handleImageSelected(
                      e.target.files?.[0] || null
                    )
                  }
                />

                <label
                  htmlFor="duo-card-upload"
                  className="duo-reading-panel__upload-trigger"
                >
                  <Upload size={18} />
                  <span>
                    Chọn ảnh lá bài
                  </span>
                </label>

                {previewUrl && (
                  <div className="duo-reading-panel__preview-card">
                    <img
                      src={previewUrl}
                      alt={selectedImage?.name || "Lá bài đã chọn"}
                      className="duo-reading-panel__preview-image"
                    />

                    <button
                      type="button"
                      className="duo-reading-panel__preview-remove"
                      onClick={clearSelectedImage}
                      title="Xóa ảnh đã chọn"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="duo-reading-panel__upload-actions">
                <button
                  type="button"
                  className="duo-reading-panel__button duo-reading-panel__button--primary"
                  onClick={
                    handleUploadMyCard
                  }
                  disabled={loading}
                >
                  {loading
                    ? "Đang tải lên..."
                    : "Tải lên lá bài của tôi"}
                </button>
              </div>
            </>
          ) : (
            <div className="duo-reading-panel__note">
              Bạn đã tải lên lá bài của mình rồi.
            </div>
          )}
        </div>

        {isOwner &&
          hasBothCards &&
          duoSession?.status !== "completed" && (
            <div className="duo-reading-panel__note">
              Trải bài chung sẽ được tạo tự động sau khi cả hai lá bài được tải lên.
            </div>
          )}
    </>
  );

  return (
    <div className="duo-reading-panel-shell">
      <div
        className={`duo-reading-panel ${
          view === "landing"
            ? "duo-reading-panel--landing"
            : ""
        }`}
      >
        <div className="duo-reading-panel__content">
          {view === "landing" && renderLanding()}
          {view === "joining" && renderJoining()}
          {view === "room" && renderRoom()}

          {error && (
            <div className="duo-reading-panel__error">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Portal ra <body> để THOÁT khỏi ancestor có transform (wrapper duo
          dùng translate(-50%,-50%) tạo containing block, khiến position:fixed
          bị neo theo wrapper thay vì viewport → panel lệch vào giữa). */}
      {showFloatingResultSidebar &&
        createPortal(renderResultSidebar(), document.body)}

      {showDuoGeneratingOverlay && (
        <MysticLoader label="Đang tạo trải bài đôi" />
      )}
    </div>
  );
}
