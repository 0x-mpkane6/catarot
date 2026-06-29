import CommunityPostCard from "./CommunityPostCard";

export default function CommunityFeed({
  posts = [],
  busyMap = {},
  isError = false,
  errorMessage = "",
  onRetry,
  onAddInterpretation,
  onVoteInterpretation,
  onResonateInterpretation,
}) {
  if (!posts.length) {
    // Phân biệt "lỗi tải" với "rỗng thật": lỗi mạng/server không nên trông như chưa có bài.
    if (isError) {
      return (
        <div className="community-card">
          <div className="community-empty">
            {errorMessage ||
              "Không tải được phòng cộng đồng. Vui lòng thử lại."}
            {onRetry && (
              <>
                <br />
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    marginTop: "12px",
                    padding: "8px 18px",
                    borderRadius: "999px",
                    border: "1px solid rgba(192,132,252,0.45)",
                    background: "rgba(168,85,247,0.18)",
                    color: "#f5e9ff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Thử lại
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="community-card">
        <div className="community-empty">
          Phòng Cộng Đồng hiện đang yên ắng.
          <br />
          Hãy quay lại sau khi kiểm duyệt phê duyệt những
          trải bài được chia sẻ đầu tiên.
        </div>
      </div>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          busyMap={busyMap}
          onAddInterpretation={
            onAddInterpretation
          }
          onVoteInterpretation={
            onVoteInterpretation
          }
          onResonateInterpretation={
            onResonateInterpretation
          }
        />
      ))}
    </>
  );
}
