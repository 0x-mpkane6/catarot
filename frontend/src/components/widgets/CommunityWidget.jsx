import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../lib/api";

export default function CommunityWidget() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    apiRequest("/api/community/feed?page=1&page_size=4", { auth: false })
      .then((data) => setCount((data.items || []).length))
      .catch(() => setCount(0));
  }, []);

  return (
    <Link className="widget-card community-widget" to="/community">
      <MessagesSquare size={18} />
      <div>
        <span>Phòng cộng đồng</span>
        <strong>{count ? `${count} tín hiệu mới` : "Đang lắng nghe"}</strong>
      </div>
    </Link>
  );
}
