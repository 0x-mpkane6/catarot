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
          The community feed is quiet right now.
          <br />
          Come back after moderation approves the first
          shared readings.
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
