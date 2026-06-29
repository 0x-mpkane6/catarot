import useReducedMotion from "../../hooks/useReducedMotion";
import "./MobileAuroraBackground.css";

// Nền "cực quang" sống động — CHỈ cho mobile. Ba quầng sáng tím/hồng/chàm trôi
// chậm phía sau nội dung, thay cho nền tĩnh trước đây (bù lại cảm giác "sống"
// đã mất khi hiệu ứng con trỏ chuột bị tắt trên cảm ứng).
//
// Chỉ chuyển động bằng transform + opacity → chạy trên compositor, mượt 60fps,
// nhẹ pin. Tôn trọng "Giảm chuyển động": các quầng đứng yên hoàn toàn.
export default function MobileAuroraBackground() {
  const reduced = useReducedMotion();

  return (
    <div
      className={`mobile-aurora${reduced ? " is-static" : ""}`}
      aria-hidden="true"
    >
      <span className="mobile-aurora__blob mobile-aurora__blob--violet" />
      <span className="mobile-aurora__blob mobile-aurora__blob--magenta" />
      <span className="mobile-aurora__blob mobile-aurora__blob--indigo" />
    </div>
  );
}
