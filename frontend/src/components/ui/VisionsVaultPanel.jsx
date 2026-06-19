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
    label: "Hộp Thời Gian",
    hint: "Xem lại các trải bài đã niêm phong, đã hé lộ và đã xác minh.",
    icon: Clock3,
  },
  {
    key: "seal",
    label: "Niêm phong hộp",
    hint: "Khóa một dự đoán cho đến khi tương lai gọi tên.",
    icon: Eye,
  },
  {
    key: "dreams",
    label: "Nhật Ký Giấc Mơ",
    hint: "Xem lại các biểu tượng giấc mơ và bản đồ ẩn tinh.",
    icon: MoonStar,
  },
  {
    key: "record",
    label: "Ghi lại giấc mơ",
    hint: "Viết hoặc tải lên một giấc mơ để giải mã.",
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
          "Đã niêm phong hộp thời gian"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
        throw error; // ném lại để form con KHÔNG xoá nội dung khi gửi thất bại
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
          "Đã mở hộp"
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
          "Đã lưu đánh giá"
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
          "Đã lưu giấc mơ"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getVisionsErrorMessage(
            error
          )
        );
        throw error; // ném lại để form con KHÔNG xoá nội dung khi gửi thất bại
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
            Niêm phong một trải bài cho chính bạn trong tương lai.
            Bạn sẽ chỉ thấy được dự đoán đầy đủ sau ngày hé lộ.
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
            Giấc mơ có thể được gõ hoặc ghi âm. Hệ thống sẽ
            trích xuất các biểu tượng và kiểm tra sự trùng khớp
            với các trải bài gần đây.
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
              Chưa có bản ghi giấc mơ nào.
              <br />
              Ghi lại giấc mơ đầu tiên để bắt đầu xây dựng
              kho lưu trữ.
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
            Chưa có hộp nào.
            <br />
            Niêm phong trải bài tương lai đầu tiên để khởi tạo
            kho.
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
            Kho Tầm Nhìn
          </div>
          <div className="visions-panel__title">
            Tương lai niêm phong, giấc mơ giải mã
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
            title="Làm mới tầm nhìn"
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
