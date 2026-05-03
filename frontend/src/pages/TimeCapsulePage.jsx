import { useEffect, useState } from "react";
import { Hourglass, Lock, Star, Unlock } from "lucide-react";
import ProtectedGate from "../components/ui/ProtectedGate";
import { apiRequest } from "../lib/api";
import { useOracleStore } from "../stores/oracleStore";

export default function TimeCapsulePage() {
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", question_text: "", prediction_text: "", reveal_at: "" });
  const [verdicts, setVerdicts] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCapsules = async () => {
    try {
      const data = await apiRequest("/api/time-capsules?limit=50");
      setItems(data.items || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    setOracleState("sleeping");
    loadCapsules();
  }, [setOracleState]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const createCapsule = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const revealAtIso = new Date(form.reveal_at).toISOString();
      await apiRequest("/api/time-capsules", {
        method: "POST",
        body: {
          title: form.title,
          question_text: form.question_text,
          prediction_text: form.prediction_text,
          reveal_at: revealAtIso,
          cards: [],
        },
      });
      setForm({ title: "", question_text: "", prediction_text: "", reveal_at: "" });
      setNotice("Lời tiên tri đã được niêm phong.");
      await loadCapsules();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const reveal = async (id) => {
    try {
      await apiRequest(`/api/time-capsules/${id}/reveal`, { method: "POST" });
      await loadCapsules();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const submitVerdict = async (id) => {
    const payload = verdicts[id] || {};
    try {
      await apiRequest(`/api/time-capsules/${id}/verdict`, {
        method: "POST",
        body: {
          accuracy_score: Number(payload.score || 3),
          accuracy_note: payload.note || null,
        },
      });
      await loadCapsules();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <ProtectedGate title="Viên nang thời gian cần được giữ riêng">
      <div className="capsule-page">
        <div className="page-kicker"><Hourglass size={16} /> Time Capsule</div>
        <section className="capsule-grid">
          <form className="glass-panel capsule-form" onSubmit={createCapsule}>
            <h1>Niêm phong một lời tiên tri</h1>
            <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Tiêu đề viên nang" required />
            <textarea value={form.question_text} onChange={(event) => updateForm("question_text", event.target.value)} rows={3} placeholder="Câu hỏi muốn gửi tới tương lai" required />
            <textarea value={form.prediction_text} onChange={(event) => updateForm("prediction_text", event.target.value)} rows={4} placeholder="Lời tiên tri hoặc điều ngươi muốn kiểm chứng" required />
            <input value={form.reveal_at} onChange={(event) => updateForm("reveal_at", event.target.value)} type="datetime-local" required />
            <button className="primary-button" type="submit">
              <Lock size={17} />
              <span>Niêm phong</span>
            </button>
            {notice && <p className="success-message">{notice}</p>}
            {error && <p className="mystic-error">{error}</p>}
          </form>

          <section className="capsule-list">
            {items.map((item) => (
              <article key={item.id} className={`capsule-card ${item.is_unlocked ? "unlocked" : "sealed"}`}>
                <div className="post-header">
                  {item.is_unlocked ? <Unlock size={16} /> : <Lock size={16} />}
                  <strong>{item.title}</strong>
                  <span>{item.status}</span>
                </div>
                <p>{item.is_unlocked ? item.prediction_text : item.seal_message}</p>
                <small>Mở vào {item.reveal_at ? new Date(item.reveal_at).toLocaleString("vi-VN") : "chưa rõ"}</small>
                <div className="post-actions">
                  <button className="secondary-magic-button" type="button" onClick={() => reveal(item.id)} disabled={!item.is_unlocked}>
                    Mở viên nang
                  </button>
                </div>
                {item.is_unlocked && (
                  <div className="verdict-row">
                    <select value={verdicts[item.id]?.score || 3} onChange={(event) => setVerdicts({ ...verdicts, [item.id]: { ...verdicts[item.id], score: event.target.value } })}>
                      {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} sao</option>)}
                    </select>
                    <input value={verdicts[item.id]?.note || ""} onChange={(event) => setVerdicts({ ...verdicts, [item.id]: { ...verdicts[item.id], note: event.target.value } })} placeholder="Ghi chú kiểm chứng" />
                    <button className="chip-button" type="button" onClick={() => submitVerdict(item.id)}>
                      <Star size={14} /> Lưu
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!items.length && (
              <section className="empty-state">
                <Hourglass size={26} />
                <h2>Chưa có lời tiên tri nào ngủ yên</h2>
                <p>Hãy tạo viên nang đầu tiên cho một ngày trong tương lai.</p>
              </section>
            )}
          </section>
        </section>
      </div>
    </ProtectedGate>
  );
}
