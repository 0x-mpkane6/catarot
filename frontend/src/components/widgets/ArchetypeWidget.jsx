import { useEffect, useState } from "react";
import { CircleUserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

export default function ArchetypeWidget() {
  const user = useAuthStore((state) => state.user);
  const [soulCard, setSoulCard] = useState("");

  useEffect(() => {
    if (!user) {
      setSoulCard("");
      return;
    }
    apiRequest(`/api/users/${user.id}/archetype_profile`)
      .then((data) => setSoulCard(data.soul_card || "Đang thành hình"))
      .catch(() => setSoulCard("Chưa đủ dấu vết"));
  }, [user]);

  return (
    <Link className="widget-card archetype-widget" to="/profile">
      <CircleUserRound size={18} />
      <div>
        <span>Soul Profile</span>
        <strong>{soulCard || "Ẩn trong sương"}</strong>
      </div>
    </Link>
  );
}
