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
    label: "Community Feed",
    hint: "Explore approved readings and interpretations.",
    icon: MessageSquareHeart,
  },
  {
    key: "share",
    label: "Share Reading",
    hint: "Submit a reading question for moderation.",
    icon: Send,
  },
  {
    key: "moderation",
    label: "Moderation",
    hint: "Review pending posts if you are an admin.",
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
          "Post submitted for moderation"
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
          "Interpretation shared"
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
            ? "Vote added"
            : "You already voted for this interpretation"
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
          "Interpretation marked as resonated"
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
          "Post approved"
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
          "Post rejected"
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
            Community posts are anonymous and go through
            moderation before entering the public feed.
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
            Community Reading Room
          </div>
          <div className="community-panel__title">
            Shared insight, softly moderated
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
            title="Refresh community"
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
