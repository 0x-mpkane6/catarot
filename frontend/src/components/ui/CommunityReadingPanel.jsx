import "./CommunityReadingPanel.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  MessageSquareHeart,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

import CommunityFeed from "./CommunityFeed";
import CommunityModerationPanel from "./CommunityModerationPanel";
import CommunityPostComposer from "./CommunityPostComposer";
import {
  addCommunityInterpretation,
  approveCommunityPost,
  createCommunityPost,
  getCommunityErrorMessage,
  getCommunityFeed,
  getCommunityModerationQueue,
  rejectCommunityPost,
  resonateCommunityInterpretation,
  voteCommunityInterpretation,
} from "../../services/communityService";

const TABS = [
  {
    key: "feed",
    label: "Phòng Cộng Đồng",
    hint: "Khám phá những trải bài và lời luận giải đã được duyệt.",
    icon: MessageSquareHeart,
  },
  {
    key: "share",
    label: "Chia sẻ trải bài",
    hint: "Gửi một câu hỏi trải bài để kiểm duyệt.",
    icon: Send,
  },
  {
    key: "moderation",
    label: "Kiểm duyệt",
    hint: "Xem xét các bài viết đang chờ nếu bạn là quản trị viên.",
    icon: ShieldCheck,
  },
];

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

const updatePostInFeed = (
  posts,
  postId,
  updater
) =>
  posts.map((post) =>
    post.id === postId
      ? updater(post)
      : post
  );

export default function CommunityReadingPanel() {
  const storedUser = useMemo(
    () => getStoredUser(),
    []
  );

  const isAdmin =
    storedUser?.role === "admin";

  const [activeTab, setActiveTab] =
    useState("feed");
  const [feedItems, setFeedItems] =
    useState([]);
  const [moderationItems, setModerationItems] =
    useState([]);
  const [isLoadingFeed, setIsLoadingFeed] =
    useState(false);
  const [isSubmittingPost, setIsSubmittingPost] =
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

  const loadFeed = useCallback(async () => {
    try {
      setIsLoadingFeed(true);
      const payload =
        await getCommunityFeed();
      setFeedItems(
        payload.items || []
      );
    } catch (error) {
      console.error(error);
      toast.error(
        getCommunityErrorMessage(
          error
        )
      );
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  const loadModerationQueue =
    useCallback(async () => {
      if (!isAdmin) return;

      try {
        const payload =
          await getCommunityModerationQueue();
        setModerationItems(
          payload.items || []
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getCommunityErrorMessage(
            error
          )
        );
      }
    }, [isAdmin]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (
      activeTab ===
        "moderation" &&
      isAdmin
    ) {
      loadModerationQueue();
    }
  }, [
    activeTab,
    isAdmin,
    loadModerationQueue,
  ]);

  const handleRefresh =
    async () => {
      if (
        activeTab ===
          "moderation" &&
        isAdmin
      ) {
        await loadModerationQueue();
        return;
      }

      await loadFeed();
    };

  const handleCreatePost =
    async (payload) => {
      try {
        setIsSubmittingPost(true);
        await createCommunityPost(
          payload
        );
        toast.success(
          "Đã gửi bài viết để kiểm duyệt"
        );
        setActiveTab("feed");
      } catch (error) {
        console.error(error);
        toast.error(
          getCommunityErrorMessage(
            error
          )
        );
      } finally {
        setIsSubmittingPost(false);
      }
    };

  const handleAddInterpretation =
    async (
      postId,
      content
    ) => {
      const key =
        `interpret-${postId}`;

      try {
        setBusy(key, true);

        const created =
          await addCommunityInterpretation(
            postId,
            content
          );

        setFeedItems((prev) =>
          updatePostInFeed(
            prev,
            postId,
            (post) => ({
              ...post,
              interpretations: [
                created,
                ...(post.interpretations ||
                  []),
              ],
            })
          )
        );

        toast.success(
          "Đã chia sẻ lời luận giải"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getCommunityErrorMessage(
            error
          )
        );
      } finally {
        setBusy(key, false);
      }
    };

  const handleVoteInterpretation =
    async (
      postId,
      interpretationId
    ) => {
      const key =
        `vote-${interpretationId}`;

      try {
        setBusy(key, true);

        const result =
          await voteCommunityInterpretation(
            interpretationId
          );

        setFeedItems((prev) =>
          updatePostInFeed(
            prev,
            postId,
            (post) => ({
              ...post,
              interpretations:
                post.interpretations.map(
                  (
                    interpretation
                  ) =>
                    interpretation.id ===
                    interpretationId
                      ? {
                          ...interpretation,
                          vote_count:
                            result.vote_count,
                        }
                      : interpretation
                ),
            })
          )
        );

        toast.success(
          result.created
            ? "Đã thêm bình chọn"
            : "Bạn đã bình chọn cho lời luận giải này rồi"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getCommunityErrorMessage(
            error
          )
        );
      } finally {
        setBusy(key, false);
      }
    };

  const handleResonateInterpretation =
    async (
      postId,
      interpretationId
    ) => {
      const key =
        `resonate-${interpretationId}`;

      try {
        setBusy(key, true);

        await resonateCommunityInterpretation(
          interpretationId
        );

        setFeedItems((prev) =>
          updatePostInFeed(
            prev,
            postId,
            (post) => ({
              ...post,
              interpretations:
                post.interpretations.map(
                  (
                    interpretation
                  ) => ({
                    ...interpretation,
                    resonated_by_post_owner:
                      interpretation.id ===
                      interpretationId,
                  })
                ),
            })
          )
        );

        toast.success(
          "Đã đánh dấu lời luận giải là đồng cảm"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getCommunityErrorMessage(
            error
          )
        );
      } finally {
        setBusy(key, false);
      }
    };

  const handleApprovePost =
    async (
      postId,
      reason
    ) => {
      const key =
        `moderate-${postId}`;

      try {
        setBusy(key, true);
        await approveCommunityPost(
          postId,
          reason
        );

        setModerationItems(
          (prev) =>
            prev.filter(
              (post) =>
                post.id !== postId
            )
        );

        toast.success(
          "Đã duyệt bài viết"
        );
        await loadFeed();
      } catch (error) {
        console.error(error);
        toast.error(
          getCommunityErrorMessage(
            error
          )
        );
      } finally {
        setBusy(key, false);
      }
    };

  const handleRejectPost =
    async (
      postId,
      reason
    ) => {
      const key =
        `moderate-${postId}`;

      try {
        setBusy(key, true);
        await rejectCommunityPost(
          postId,
          reason
        );

        setModerationItems(
          (prev) =>
            prev.filter(
              (post) =>
                post.id !== postId
            )
        );

        toast.success(
          "Đã từ chối bài viết"
        );
      } catch (error) {
        console.error(error);
        toast.error(
          getCommunityErrorMessage(
            error
          )
        );
      } finally {
        setBusy(key, false);
      }
    };

  const visibleTabs = TABS.filter(
    (tab) =>
      tab.key !==
        "moderation" ||
      isAdmin
  );

  const activeTabMeta =
    visibleTabs.find(
      (tab) =>
        tab.key === activeTab
    ) || visibleTabs[0];

  const renderContent = () => {
    if (activeTab === "share") {
      return (
        <>
          <div className="community-banner">
            Bài viết trong cộng đồng là ẩn danh và phải qua
            kiểm duyệt trước khi xuất hiện trong phòng công khai.
          </div>
          <CommunityPostComposer
            onSubmit={
              handleCreatePost
            }
            isSubmitting={
              isSubmittingPost
            }
          />
        </>
      );
    }

    if (
      activeTab ===
      "moderation"
    ) {
      return (
        <CommunityModerationPanel
          items={moderationItems}
          busyMap={busyMap}
          onApprove={
            handleApprovePost
          }
          onReject={
            handleRejectPost
          }
        />
      );
    }

    return (
      <CommunityFeed
        posts={feedItems}
        busyMap={busyMap}
        onAddInterpretation={
          handleAddInterpretation
        }
        onVoteInterpretation={
          handleVoteInterpretation
        }
        onResonateInterpretation={
          handleResonateInterpretation
        }
      />
    );
  };

  return (
    <div className="community-panel">
      <aside className="community-panel__sidebar">
        <div className="community-panel__brand">
          <div className="community-panel__eyebrow">
            Phòng Trải Bài Cộng Đồng
          </div>
          <div className="community-panel__title">
            Sẻ chia góc nhìn, kiểm duyệt nhẹ nhàng
          </div>
        </div>

        <div className="community-panel__tab-list">
          {visibleTabs.map(
            (tab) => {
              const Icon =
                tab.icon;

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`community-panel__tab ${
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
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: "10px",
                    }}
                  >
                    <Icon size={17} />
                    <span className="community-panel__tab-label">
                      {tab.label}
                    </span>
                  </div>

                  <div className="community-panel__tab-hint">
                    {tab.hint}
                  </div>
                </button>
              );
            }
          )}
        </div>

      </aside>

      <section className="community-panel__content">
        <div className="community-panel__content-header">
          <div>
            <div className="community-panel__content-title">
              {activeTabMeta?.label}
            </div>
            <div className="community-panel__content-copy">
              {activeTabMeta?.hint}
            </div>
          </div>

          <button
            type="button"
            className="community-panel__refresh"
            onClick={handleRefresh}
            title="Làm mới cộng đồng"
            disabled={isLoadingFeed}
          >
            <RefreshCw
              size={18}
            />
          </button>
        </div>

        <div className="community-panel__scroll">
          {renderContent()}
        </div>
      </section>
    </div>
  );
}
