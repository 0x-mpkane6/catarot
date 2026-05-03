import { useEffect, useState } from "react";
import { Flame, PenLine, Sparkles } from "lucide-react";
import TarotCard from "../components/tarot/TarotCard";
import ProtectedGate from "../components/ui/ProtectedGate";
import { useDailyCardStore } from "../stores/dailyCardStore";
import { useOracleStore } from "../stores/oracleStore";

export default function DailyCardPage() {
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const { today, streak, history, loading, error, loadDailyData, draw, reflect } = useDailyCardStore();
  const [moodPre, setMoodPre] = useState("");
  const [moodPost, setMoodPost] = useState("");
  const [reflection, setReflection] = useState("");

  useEffect(() => {
    setOracleState("welcome", "Lá bài hôm nay đã chờ ngươi.");
    loadDailyData();
  }, [loadDailyData, setOracleState]);

  return (
    <ProtectedGate title="Lá bài hằng ngày cần một tài khoản">
      <div className="daily-page">
        <div className="page-kicker"><Flame size={16} /> Daily Ritual</div>
        <section className="ritual-hero">
          <div>
            <h1>Lá bài hôm nay đã chọn ngươi</h1>
            <p>Ghi lại tâm trạng, rút một lá và giữ ngọn lửa streak sáng qua từng ngày.</p>
            <div className="inline-form">
              <input value={moodPre} onChange={(event) => setMoodPre(event.target.value)} placeholder="Tâm trạng trước khi rút..." />
              <button className="primary-button" type="button" onClick={() => draw(moodPre)} disabled={loading}>
                <Sparkles size={17} />
                <span>{today ? "Xem lại lá hôm nay" : "Rút lá hôm nay"}</span>
              </button>
            </div>
            {error && <p className="mystic-error">{error}</p>}
          </div>
          <div className="daily-card-stage">
            <TarotCard card={today ? { name: today.card_name, orientation: today.orientation, position: "present" } : { position: "present" }} revealed={Boolean(today)} />
          </div>
        </section>

        {today && (
          <section className="daily-details">
            <article className="glass-panel">
              <h2>{today.card_name}</h2>
              <p className="gold-text">{today.affirmation}</p>
              <div className="keyword-row">
                {(today.keywords || []).map((keyword) => <span key={keyword}>{keyword}</span>)}
              </div>
            </article>
            <article className="glass-panel">
              <h2>Phản chiếu cuối ngày</h2>
              <input value={moodPost} onChange={(event) => setMoodPost(event.target.value)} placeholder="Tâm trạng sau khi ngẫm..." />
              <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} rows={4} placeholder="Điều lá bài khiến ngươi nhận ra..." />
              <button className="secondary-magic-button" type="button" onClick={() => reflect({ reflection, moodPost })} disabled={loading}>
                <PenLine size={16} />
                <span>Lưu phản chiếu</span>
              </button>
            </article>
          </section>
        )}

        <section className="history-grid">
          <article className="glass-panel streak-big">
            <Flame size={24} />
            <strong>{streak?.current_streak || 0}</strong>
            <span>ngày liên tục</span>
          </article>
          {history.map((item) => (
            <article key={item.id} className="history-item">
              <strong>{item.draw_date}</strong>
              <span>{item.card_name}</span>
            </article>
          ))}
        </section>
      </div>
    </ProtectedGate>
  );
}
