import CommunityPostCard from "./CommunityPostCard";

export default function CommunityFeed({
  posts = [],
  busyMap = {},
  onAddInterpretation,
  onVoteInterpretation,
  onResonateInterpretation,
}) {
  if (!posts.length) {
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
