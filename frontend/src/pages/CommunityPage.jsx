import { useEffect, useState } from "react";
import { HeartHandshake, MessageSquarePlus, Sparkles, ThumbsUp } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useOracleStore } from "../stores/oracleStore";

export default function CommunityPage() {
  const user = useAuthStore((state) => state.user);
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const [items, setItems] = useState([]);
  const [question, setQuestion] = useState("");
  const [replyByPost, setReplyByPost] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadFeed = async () => {
    try {
      const data = await apiRequest("/api/community/feed?page=1&page_size=20", { auth: false });
      setItems(data.items || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    setOracleState("idle", "Một căn phòng ẩn nơi những người tìm dấu hiệu cùng chia sẻ cách hiểu.");
    loadFeed();
  }, [setOracleState]);

  const createPost = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await apiRequest("/api/community/posts", {
        method: "POST",
        body: { question_text: question, card_summary: [] },
      });
      setQuestion("");
      setNotice("Bài viết đã được niêm vào hàng chờ duyệt.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const addInterpretation = async (postId) => {
    const content = replyByPost[postId] || "";
    if (!content.trim()) {
      return;
    }
    try {
      await apiRequest(`/api/community/posts/${postId}/interpretations`, {
        method: "POST",
        body: { content },
      });
      setReplyByPost({ ...replyByPost, [postId]: "" });
      await loadFeed();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const vote = async (interpretationId) => {
    await apiRequest(`/api/community/interpretations/${interpretationId}/vote`, { method: "POST" });
    await loadFeed();
  };

  const resonate = async (interpretationId) => {
    await apiRequest(`/api/community/interpretations/${interpretationId}/resonate`, { method: "POST" });
    await loadFeed();
  };

  return (
    <div className="community-page">
      <div className="page-kicker"><HeartHandshake size={16} /> Community Room</div>
      <section className="community-intro">
        <h1>Căn phòng ẩn của những người đi tìm dấu hiệu</h1>
        <p>Chia sẻ câu hỏi, đọc cách người khác diễn giải và đánh dấu những lời chạm đúng điều ngươi cảm nhận.</p>
      </section>

      {user ? (
        <form className="glass-panel community-form" onSubmit={createPost}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} placeholder="Ẩn danh chia sẻ câu hỏi hoặc trải bài của ngươi..." />
          <button className="primary-button" type="submit" disabled={!question.trim()}>
            <MessageSquarePlus size={17} />
            <span>Gửi vào phòng cộng đồng</span>
          </button>
        </form>
      ) : (
        <p className="muted-text">Đăng nhập để gửi bài hoặc phản hồi; feed công khai vẫn có thể đọc.</p>
      )}

      {notice && <p className="success-message">{notice}</p>}
      {error && <p className="mystic-error">{error}</p>}

      <section className="community-feed">
        {items.length ? items.map((post) => (
          <article key={post.id} className="community-post">
            <div className="post-header">
              <Sparkles size={16} />
              <strong>{post.anonymous_alias}</strong>
              <span>{new Date(post.created_at).toLocaleDateString("vi-VN")}</span>
            </div>
            <p>{post.question_text}</p>
            <div className="interpretations">
              {(post.interpretations || []).map((interpretation) => (
                <div key={interpretation.id} className="interpretation">
                  <p>{interpretation.content}</p>
                  <div className="post-actions">
                    <button type="button" className="chip-button" onClick={() => vote(interpretation.id)} disabled={!user}>
                      <ThumbsUp size={14} /> {interpretation.vote_count}
                    </button>
                    <button type="button" className="chip-button" onClick={() => resonate(interpretation.id)} disabled={!user}>
                      Cộng hưởng
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {user && (
              <div className="reply-row">
                <input value={replyByPost[post.id] || ""} onChange={(event) => setReplyByPost({ ...replyByPost, [post.id]: event.target.value })} placeholder="Gửi một cách hiểu..." />
                <button type="button" className="secondary-magic-button" onClick={() => addInterpretation(post.id)}>Gửi</button>
              </div>
            )}
          </article>
        )) : (
          <section className="empty-state">
            <Sparkles size={26} />
            <h2>Phòng cộng đồng đang yên ắng</h2>
            <p>Khi các bài được duyệt, những dấu hiệu đầu tiên sẽ xuất hiện ở đây.</p>
          </section>
        )}
      </section>
    </div>
  );
}
