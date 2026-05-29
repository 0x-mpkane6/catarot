import "./DuoReadingPanel.css";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Copy,
  RefreshCw,
  SquareArrowRightExit,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  createDuoSession,
  getDuoSession,
  joinDuoByInvite,
  uploadDuoCard,
} from "../../services/duoService";

const ACTIVE_DUO_SESSION_KEY = "active_duo_session_id";

const getErrorMessage = (error) =>
  error?.response?.data?.detail ||
  error?.message ||
  "Something went wrong";

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

const getStatusMessage = (session) => {
  const status = session?.status;
  const cardsCount =
    session?.cards?.length || 0;

  if (status === "waiting_partner") {
    return "Waiting for partner to join...";
  }

  if (status === "waiting_cards") {
    if (cardsCount === 0) {
      return "Both users need to upload their cards.";
    }

    if (cardsCount === 1) {
      return "Waiting for the other card...";
    }

    return "Both users need to upload their cards.";
  }

  if (status === "generating") {
    return "Generating shared reading...";
  }

  if (status === "completed") {
    return "Shared reading completed.";
  }

  if (status === "failed") {
    return "Duo reading failed. Please try again.";
  }

  return "Room created.";
};

const formatJoinedAt = (value) => {
  if (!value) return "Joined";

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
  if (!participant) return "Partner";

  const directName =
    participant.display_name ||
    participant.displayName ||
    participant.username ||
    participant.user_name ||
    participant.name ||
    participant.user?.display_name ||
    participant.user?.username ||
    participant.user?.email;

  if (directName) return directName;

  if (
    storedUser?.id &&
    participant.user_id === storedUser.id
  ) {
    return (
      storedUser.display_name ||
      storedUser.displayName ||
      storedUser.username ||
      storedUser.email ||
      "You"
    );
  }

  return participant.slot_label
    ? `Participant ${participant.slot_label}`
    : "Partner";
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

  const isOwner =
    currentUserId !== null &&
    currentUserId ===
      duoSession?.owner_user_id;

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

    const intervalId =
      window.setInterval(
        async () => {
          try {
            const payload =
              await getDuoSession(
                duoSession.id
              );
            setDuoSession(payload);
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
      toast.error("Waiting for partner to join.");
      return;
    }

    if (currentUserCard) {
      toast.error("You already uploaded a card.");
      return;
    }

    if (!selectedImage) {
      toast.error("Please choose a card image first.");
      return;
    }

    await handleUploadCard();
  };

  const handleCopyInviteCode = async () => {
    const code = duoSession?.invite_code || "";

    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      toast.success("Invite code copied");
    } catch {
      toast.error("Failed to copy invite code");
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

  const renderLanding = () => (
    <div className="duo-reading-panel__actions duo-reading-panel__actions--center">
      <button
        type="button"
        className="duo-reading-panel__button duo-reading-panel__button--primary"
        onClick={handleCreateRoom}
        disabled={loading}
      >
        {loading ? "Creating..." : "Create Duo Room"}
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
        Join With Invite Code
      </button>
    </div>
  );

  const renderJoining = () => (
    <div className="duo-reading-panel__join-box">
      <label className="duo-reading-panel__field-label">
        Invite Code
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
          {loading ? "Joining..." : "Join"}
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
          Back
        </button>
      </div>
    </div>
  );

  const renderRoom = () => (
    <>
      <div className="duo-reading-panel__room-header">
        <div className="duo-reading-panel__invite-card">
          <div>
            <div className="duo-reading-panel__meta-title">
              Invite Code
            </div>

            <div className="duo-reading-panel__meta-value">
              {duoSession?.invite_code || "N/A"}
            </div>
          </div>

          <button
            type="button"
            className="duo-reading-panel__copy-button"
            onClick={handleCopyInviteCode}
            title="Copy invite code"
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
            title="Refresh room"
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="duo-reading-panel__icon-button duo-reading-panel__icon-button--danger"
            title="Leave room"
            onClick={handleLeaveRoom}
          >
            <SquareArrowRightExit size={18} />
          </button>
        </div>
      </div>

      <div className="duo-reading-panel__status-note">
        {getStatusMessage(duoSession)}
      </div>

        <div className="duo-reading-panel__section">
          <div className="duo-reading-panel__field-label">
            Participants
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
                        : `Participant ${slotLabel}`}
                    </div>

                    <div className="duo-reading-panel__slot-meta">
                      <div>
                        Joined:{" "}
                        {participant
                          ? formatJoinedAt(
                              participant.joined_at
                            )
                          : "Waiting for partner..."}
                      </div>

                      <div>
                        Card:{" "}
                        {participant
                          ? card
                            ? `${card.card_name} (${card.orientation})`
                            : "Waiting for upload"
                          : "Waiting for partner..."}
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
            Upload Card
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
                    Choose Card Image
                  </span>
                </label>

                {previewUrl && (
                  <div className="duo-reading-panel__preview-card">
                    <img
                      src={previewUrl}
                      alt={selectedImage?.name || "Selected card"}
                      className="duo-reading-panel__preview-image"
                    />

                    <button
                      type="button"
                      className="duo-reading-panel__preview-remove"
                      onClick={clearSelectedImage}
                      title="Remove selected image"
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
                    ? "Uploading..."
                    : "Upload My Card"}
                </button>
              </div>
            </>
          ) : (
            <div className="duo-reading-panel__note">
              You already uploaded your card.
            </div>
          )}
        </div>

        {isOwner &&
          participants.length === 2 &&
          (duoSession?.cards?.length || 0) === 2 &&
          duoSession?.status !== "completed" && (
            <div className="duo-reading-panel__note">
              Shared reading will be generated automatically after both cards are uploaded.
            </div>
          )}

      {duoSession?.status === "completed" &&
        duoSession?.reading && (
          <div className="duo-reading-panel__result">
            <div className="duo-reading-panel__field-label">
              Duo Reading Result
            </div>

            <div className="duo-reading-panel__result-text">
              {duoSession.reading.generated_text}
            </div>
          </div>
        )}
    </>
  );

  return (
    <div className="duo-reading-panel-shell">
      <div className="duo-reading-panel">
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
    </div>
  );
}
