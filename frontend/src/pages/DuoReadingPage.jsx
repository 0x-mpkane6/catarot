import { useEffect, useState } from "react";
import { Copy, Link2, Radio, UploadCloud, UsersRound } from "lucide-react";
import ProtectedGate from "../components/ui/ProtectedGate";
import TarotCard from "../components/tarot/TarotCard";
import { useAuthStore } from "../stores/authStore";
import { useDuoStore } from "../stores/duoStore";
import { useOracleStore } from "../stores/oracleStore";

const eventCopy = {
  snapshot: "Ảnh chụp năng lượng đã đến.",
  duo_created: "Một phòng duo vừa được mở.",
  duo_joined: "Một nguồn năng lượng thứ hai đã bước vào.",
  duo_updated: "Lá bài mới vừa được đặt lên bàn.",
  pong: "Kết nối vẫn còn sáng.",
};

export default function DuoReadingPage() {
  const token = useAuthStore((state) => state.token);
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const { session, events, loading, error, createSession, joinByInvite, uploadCard, clear } = useDuoStore();
  const [inviteCode, setInviteCode] = useState("");
  const [cardFile, setCardFile] = useState(null);

  useEffect(() => {
    setOracleState("welcome", "Hai nguồn năng lượng đã cùng bước vào căn phòng.");
    return () => clear();
  }, [clear, setOracleState]);

  const handleCopy = async () => {
    if (session?.invite_code) {
      await navigator.clipboard.writeText(session.invite_code);
    }
  };

  return (
    <ProtectedGate title="Duo Reading cần hai linh hồn đã đăng nhập">
      <div className="duo-page">
        <div className="page-kicker"><UsersRound size={16} /> Duo Reading</div>
        <section className="duo-setup">
          <div className="glass-panel">
            <h1>Kết nối hai nguồn năng lượng</h1>
            <p>Mở phòng, gửi mã mời và để Oracle đọc sự cộng hưởng giữa hai lá bài.</p>
            <div className="primary-actions">
              <button className="primary-button" type="button" onClick={() => createSession(token)} disabled={loading}>
                <Link2 size={17} />
                <span>Tạo phòng</span>
              </button>
              <div className="join-row">
                <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="Mã mời" />
                <button className="secondary-magic-button" type="button" onClick={() => joinByInvite(inviteCode, token)} disabled={loading || !inviteCode.trim()}>
                  Tham gia
                </button>
              </div>
            </div>
            {error && <p className="mystic-error">{error}</p>}
          </div>

          <div className="invite-card">
            <span>Mã mời</span>
            <strong>{session?.invite_code || "------"}</strong>
            <button className="icon-button" type="button" onClick={handleCopy} disabled={!session?.invite_code} title="Sao chép mã">
              <Copy size={18} />
            </button>
          </div>
        </section>

        <section className="duo-board">
          <div className="participant-slot">
            <strong>Nguồn A</strong>
            <span>{session?.participants?.find((item) => item.slot_label === "A") ? "Đã vào phòng" : "Đang chờ"}</span>
          </div>
          <div className="duo-center">
            <Radio size={22} />
            <span>{session?.status || "chưa mở phòng"}</span>
          </div>
          <div className="participant-slot">
            <strong>Nguồn B</strong>
            <span>{session?.participants?.find((item) => item.slot_label === "B") ? "Đã vào phòng" : "Đang chờ"}</span>
          </div>
        </section>

        {session && (
          <section className="duo-actions">
            <label className="tool-button">
              <UploadCloud size={16} />
              <span>{cardFile ? cardFile.name : "Chọn ảnh lá bài của ngươi"}</span>
              <input type="file" accept="image/*" hidden onChange={(event) => setCardFile(event.target.files?.[0] || null)} />
            </label>
            <button className="primary-button" type="button" onClick={() => uploadCard(cardFile)} disabled={loading || !cardFile}>
              Gửi lá bài
            </button>
          </section>
        )}

        <section className="duo-reading-grid">
          <div className="card-spread duo-spread">
            {(session?.cards || []).map((card, index) => (
              <TarotCard key={card.id} card={{ name: card.card_name, orientation: card.orientation, position: index === 0 ? "past" : "future" }} revealed />
            ))}
          </div>
          <article className="glass-panel">
            <h2>Lời đọc chung</h2>
            <p>{session?.reading?.generated_text || "Oracle sẽ cất lời khi cả hai lá bài đã được đặt lên bàn."}</p>
          </article>
          <article className="event-feed">
            <h2>Tín hiệu realtime</h2>
            {events.length ? events.map((event) => (
              <p key={event.id}>{eventCopy[event.type] || event.type}</p>
            )) : <p className="muted-text">WebSocket sẽ hiển thị sự kiện tại đây.</p>}
          </article>
        </section>
      </div>
    </ProtectedGate>
  );
}
