import "./VisionsVaultPanel.css";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Clock3,
  Eye,
  MoonStar,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

import DreamEntryCard from "./DreamEntryCard";
import DreamJournalComposer from "./DreamJournalComposer";
import TimeCapsuleCard from "./TimeCapsuleCard";
import TimeCapsuleComposer from "./TimeCapsuleComposer";
import {
  createDreamEntry,
  createTimeCapsule,
  getDreamEntries,
  getTimeCapsules,
  getVisionsErrorMessage,
  revealTimeCapsule,
  submitTimeCapsuleVerdict,
} from "../../services/visionsService";

const TABS = [
  {
    key: "capsules",
    label: "Time Capsules",
    hint: "Browse sealed, revealed, and verified readings.",
    icon: Clock3,
  },
  {
    key: "seal",
    label: "Seal Capsule",
    hint: "Lock a prediction until the future catches up.",
    icon: Eye,
  },
  {
    key: "dreams",
    label: "Dream Journal",
    hint: "Review dream symbols and arcana mapping.",
    icon: MoonStar,
  },
  {
    key: "record",
    label: "Record Dream",
    hint: "Write or upload a dream for decoding.",
    icon: Sparkles,
  },
];

export default function VisionsVaultPanel() {
  const [activeTab, setActiveTab] =
    useState("capsules");
  const [capsules, setCapsules] =
    useState([]);
  const [dreams, setDreams] =
    useState([]);
  const [isSubmittingCapsule, setIsSubmittingCapsule] =
    useState(false);
  const [isSubmittingDream, setIsSubmittingDream] =
    useState(false);
  const [busyMap, setBusyMap] =
    useState({});

  const setBusy = (
    key,
    value
  ) => {
    setBusyMap((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const loadCapsules =
    useCallback(async () => {
      try {
        const payload =
          await getTimeCapsules({
            limit: 40,
          });
        setCapsules(
          payload.items || []
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
      }
    }, []);

  const loadDreams =
    useCallback(async () => {
      try {
        const payload =
          await getDreamEntries({
            limit: 30,
          });
        setDreams(
          payload.items || []
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
      }
    }, []);

  useEffect(() => {
    loadCapsules();
    loadDreams();
  }, [
    loadCapsules,
    loadDreams,
  ]);

  const handleRefresh =
    async () => {
      if (
        activeTab === "dreams" ||
        activeTab === "record"
      ) {
        await loadDreams();
        return;
      }

      await loadCapsules();
    };

  const handleCreateCapsule =
    async (payload) => {
      try {
        setIsSubmittingCapsule(
          true
        );
        const created =
          await createTimeCapsule(
            payload
          );
        setCapsules((prev) => [
          created,
          ...prev,
        ]);
        setActiveTab(
          "capsules"
        );
        toast.success(
          "Time capsule sealed"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
      } finally {
        setIsSubmittingCapsule(
          false
        );
      }
    };

  const handleRevealCapsule =
    async (capsuleId) => {
      const key =
        `reveal-${capsuleId}`;

      try {
        setBusy(key, true);
        const updated =
          await revealTimeCapsule(
            capsuleId
          );
        setCapsules((prev) =>
          prev.map((capsule) =>
            capsule.id ===
            capsuleId
              ? updated
              : capsule
          )
        );
        toast.success(
          "Capsule opened"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
      } finally {
        setBusy(key, false);
      }
    };

  const handleVerdict =
    async (
      capsuleId,
      payload
    ) => {
      const key =
        `verdict-${capsuleId}`;

      try {
        setBusy(key, true);
        const updated =
          await submitTimeCapsuleVerdict(
            capsuleId,
            payload
          );
        setCapsules((prev) =>
          prev.map((capsule) =>
            capsule.id ===
            capsuleId
              ? updated
              : capsule
          )
        );
        toast.success(
          "Verdict saved"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
      } finally {
        setBusy(key, false);
      }
    };

  const handleCreateDream =
    async (payload) => {
      try {
        setIsSubmittingDream(
          true
        );
        const created =
          await createDreamEntry(
            payload
          );
        setDreams((prev) => [
          created,
          ...prev,
        ]);
        setActiveTab("dreams");
        toast.success(
          "Dream saved"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
      } finally {
        setIsSubmittingDream(
          false
        );
      }
    };

  const activeTabMeta =
    TABS.find(
      (tab) =>
        tab.key === activeTab
    ) || TABS[0];

  const renderContent = () => {
    if (activeTab === "seal") {
      return (
        <>
          <div className="visions-banner">
            Seal a reading for your future self. You will
            only see the full prediction after the reveal
            date.
          </div>
          <TimeCapsuleComposer
            onSubmit={
              handleCreateCapsule
            }
            isSubmitting={
              isSubmittingCapsule
            }
          />
        </>
      );
    }

    if (activeTab === "record") {
      return (
        <>
          <div className="visions-banner">
            Dreams can be typed or recorded. The backend
            extracts symbols and checks recent reading
            overlap.
          </div>
          <DreamJournalComposer
            onSubmit={
              handleCreateDream
            }
            isSubmitting={
              isSubmittingDream
            }
          />
        </>
      );
    }

    if (activeTab === "dreams") {
      if (!dreams.length) {
        return (
          <div className="visions-card">
            <div className="visions-empty">
              No dream entries yet.
              <br />
              Record your first dream to start building the
              archive.
            </div>
          </div>
        );
      }

      return dreams.map((dream) => (
        <DreamEntryCard
          key={dream.id}
          dream={dream}
        />
      ));
    }

    if (!capsules.length) {
      return (
        <div className="visions-card">
          <div className="visions-empty">
            No capsules yet.
            <br />
            Seal your first future reading to begin the
            vault.
          </div>
        </div>
      );
    }

    return capsules.map(
      (capsule) => (
        <TimeCapsuleCard
          key={capsule.id}
          capsule={capsule}
          busyMap={busyMap}
          onReveal={
            handleRevealCapsule
          }
          onSubmitVerdict={
            handleVerdict
          }
        />
      )
    );
  };

  return (
    <div className="visions-panel">
      <aside className="visions-panel__sidebar">
        <div className="visions-panel__brand">
          <div className="visions-panel__eyebrow">
            Visions Vault
          </div>
          <div className="visions-panel__title">
            Futures sealed, dreams decoded
          </div>
        </div>

        <div className="visions-panel__tab-list">
          {TABS.map((tab) => {
            const Icon =
              tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                className={`visions-panel__tab ${
                  activeTab ===
                  tab.key
                    ? "is-active"
                    : ""
                }`}
                onClick={() =>
                  setActiveTab(
                    tab.key
                  )
                }
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "10px",
                  }}
                >
                  <Icon size={17} />
                  <span className="visions-panel__tab-label">
                    {tab.label}
                  </span>
                </div>
                <div className="visions-panel__tab-hint">
                  {tab.hint}
                </div>
              </button>
            );
          })}
        </div>

      </aside>

      <section className="visions-panel__content">
        <div className="visions-panel__content-header">
          <div>
            <div className="visions-panel__content-title">
              {activeTabMeta.label}
            </div>
            <div className="visions-panel__content-copy">
              {activeTabMeta.hint}
            </div>
          </div>

          <button
            type="button"
            className="visions-panel__refresh"
            onClick={handleRefresh}
            title="Refresh visions"
          >
            <RefreshCw
              size={18}
            />
          </button>
        </div>

        <div className="visions-panel__scroll">
          {renderContent()}
        </div>
      </section>
    </div>
  );
}
