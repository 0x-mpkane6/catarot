import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

export default function TimeCapsuleWidget() {
  const user = useAuthStore((state) => state.user);
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!user) {
      setCount(null);
      return;
    }
    apiRequest("/api/time-capsules?limit=12")
      .then((data) => setCount((data.items || []).length))
      .catch(() => setCount(0));
  }, [user]);

  return (
    <Link className="widget-card capsule-widget" to="/time-capsule">
      <Hourglass size={18} />
      <div>
        <span>Viên nang thời gian</span>
        <strong>{user ? `${count ?? 0} lời niêm phong` : "Đang ngủ yên"}</strong>
      </div>
    </Link>
  );
}
