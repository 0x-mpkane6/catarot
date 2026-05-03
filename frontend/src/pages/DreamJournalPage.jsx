import { useEffect, useState } from "react";
import { Moon, UploadCloud } from "lucide-react";
import ProtectedGate from "../components/ui/ProtectedGate";
import { apiRequest } from "../lib/api";
import { useOracleStore } from "../stores/oracleStore";

export default function DreamJournalPage() {
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const [dreamText, setDreamText] = useState("");
  const [audio, setAudio] = useState(null);
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDreams = async () => {
    try {
      const data = await apiRequest("/api/dreams?limit=20");
      setItems(data.items || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    setOracleState("listening", "Hãy kể giấc mơ. Ta sẽ tìm những biểu tượng đang gọi tên ngươi.");
    loadDreams();
  }, [setOracleState]);

  const submitDream = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData();
    if (dreamText.trim()) {
      formData.append("raw_text", dreamText.trim());
    }
    if (audio) {
      formData.append("audio", audio);
    }
    try {
      const data = await apiRequest("/api/dreams", { method: "POST", body: formData });
      setCurrent(data);
      setDreamText("");
      setAudio(null);
      await loadDreams();
      setOracleState("speaking", "Các biểu tượng trong giấc mơ đã hiện lên dưới ánh trăng.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedGate title="Nhật ký giấc mơ cần được giữ riêng">
      <div className="dream-page">
        <div className="page-kicker"><Moon size={16} /> Dream Journal</div>
        <section className="dream-grid">
          <form className="glass-panel dream-form" onSubmit={submitDream}>
            <h1>Kể lại giấc mơ vừa ghé qua</h1>
            <textarea value={dreamText} onChange={(event) => setDreamText(event.target.value)} rows={9} placeholder="Ta thấy một mặt trăng, một cánh cửa, một dòng nước..." />
            <label className="tool-button dream-upload">
              <UploadCloud size={16} />
              <span>{audio ? audio.name : "Tải audio giấc mơ"}</span>
              <input type="file" accept="audio/*" hidden onChange={(event) => setAudio(event.target.files?.[0] || null)} />
            </label>
            {error && <p className="mystic-error">{error}</p>}
            <button className="primary-button" type="submit" disabled={loading || (!dreamText.trim() && !audio)}>
              <Moon size={17} />
              <span>{loading ? "Đang soi qua màn mơ..." : "Giải mã giấc mơ"}</span>
            </button>
          </form>
          <section className="glass-panel symbol-panel">
            <h2>Biểu tượng hiện lên</h2>
            {(current?.symbols || []).length ? (
              <>
                <div className="keyword-row">{current.symbols.map((symbol) => <span key={symbol}>{symbol}</span>)}</div>
                <div className="mapped-list">
                  {(current.mapped_arcana || []).map((card) => (
                    <article key={`${card.symbol}-${card.card_name}`}>
                      <strong>{card.symbol}</strong>
                      <span>{card.card_name} - {card.orientation}</span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted-text">Những biểu tượng sẽ tỏa sáng sau khi ngươi lưu một giấc mơ.</p>
            )}
          </section>
        </section>
        <section className="timeline-list">
          {items.map((item) => (
            <article key={item.id} className="timeline-item">
              <time>{new Date(item.created_at).toLocaleString("vi-VN")}</time>
              <p>{item.raw_text || item.transcript || "Giấc mơ bằng âm thanh"}</p>
              <div className="keyword-row small">{(item.symbols || []).map((symbol) => <span key={symbol}>{symbol}</span>)}</div>
            </article>
          ))}
        </section>
      </div>
    </ProtectedGate>
  );
}
