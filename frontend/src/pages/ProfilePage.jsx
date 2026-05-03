import { useEffect, useState } from "react";
import { BarChart3, CircleUserRound, Sparkles } from "lucide-react";
import ProtectedGate from "../components/ui/ProtectedGate";
import { apiRequest } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useOracleStore } from "../stores/oracleStore";
import { useReadingStore } from "../stores/readingStore";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const recentReadings = useReadingStore((state) => state.recentReadings);
  const [profile, setProfile] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setOracleState("speaking", "Hồ sơ linh hồn được viết từ những chủ đề lặp lại trong các lần đọc.");
    if (!user) {
      return;
    }
    Promise.allSettled([
      apiRequest(`/api/users/${user.id}/archetype_profile`),
      apiRequest(`/api/users/${user.id}/oracle_reports?limit=6`),
    ]).then(([profileResult, reportsResult]) => {
      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      }
      if (reportsResult.status === "fulfilled") {
        setReports(reportsResult.value.items || []);
      }
      if (profileResult.status === "rejected" && reportsResult.status === "rejected") {
        setError("Chưa đủ dữ liệu để Oracle dựng hồ sơ đầy đủ.");
      }
    });
  }, [setOracleState, user]);

  return (
    <ProtectedGate title="Soul Profile cần đăng nhập">
      <div className="profile-page">
        <div className="page-kicker"><CircleUserRound size={16} /> Soul Profile</div>
        <section className="profile-hero">
          <div className="astrolabe">
            <span />
            <strong>{profile?.soul_card || "?"}</strong>
          </div>
          <div>
            <h1>{profile?.soul_card || "Soul Card đang thành hình"}</h1>
            <p>{profile?.pattern_summary || "Sau nhiều lần đọc bài hơn, Oracle sẽ thấy rõ lá bài linh hồn và các chủ đề thường quay lại."}</p>
            <div className="keyword-row">
              {(profile?.top_keywords || ["clarity", "trust", "presence"]).map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
          </div>
        </section>
        {error && <p className="mystic-error">{error}</p>}
        <section className="profile-grid">
          <article className="glass-panel">
            <h2><BarChart3 size={18} /> Oracle Reports</h2>
            {reports.length ? reports.map((report) => (
              <div key={report.id} className="report-row">
                <strong>{new Date(report.period_end).toLocaleDateString("vi-VN")}</strong>
                <p>{report.narrative_text}</p>
              </div>
            )) : <p className="muted-text">Chưa có báo cáo tháng.</p>}
          </article>
          <article className="glass-panel">
            <h2><Sparkles size={18} /> Lịch sử gần đây</h2>
            {recentReadings.length ? recentReadings.map((reading) => (
              <div key={reading.id} className="report-row">
                <strong>{reading.question}</strong>
                <span>{(reading.cards || []).map((card) => card.name).join(" - ")}</span>
              </div>
            )) : <p className="muted-text">Các lần đọc trong trình duyệt này sẽ xuất hiện tại đây.</p>}
          </article>
        </section>
      </div>
    </ProtectedGate>
  );
}
