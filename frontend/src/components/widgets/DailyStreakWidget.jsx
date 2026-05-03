import { useEffect } from "react";
import { Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useDailyCardStore } from "../../stores/dailyCardStore";

export default function DailyStreakWidget() {
  const user = useAuthStore((state) => state.user);
  const streak = useDailyCardStore((state) => state.streak);
  const loadDailyData = useDailyCardStore((state) => state.loadDailyData);

  useEffect(() => {
    if (user) {
      loadDailyData();
    }
  }, [loadDailyData, user]);

  return (
    <Link className="widget-card streak-widget" to="/daily-card">
      <Flame size={18} />
      <div>
        <span>Ngọn lửa hằng ngày</span>
        <strong>{user ? `${streak?.current_streak || 0} ngày` : "Chưa đăng nhập"}</strong>
      </div>
    </Link>
  );
}
