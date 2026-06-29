import { useNavigate }
from "react-router-dom";

import { clearCachedSessions } from "../../services/sessionCache";

const getDisplayName = (
  user
) =>
  user?.display_name?.trim() ||
  user?.username?.trim() ||
  "Người dùng";

const getUsername = (
  user
) =>
  user?.username?.trim() ||
  "Chưa thiết lập";

const getAvatarUrl = (
  user
) => {
  if (user?.avatar_url) {
    return user.avatar_url;
  }

  const seed =
    user?.username ||
    user?.email ||
    "user";

  return `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
};

const getInfoRows = (
  user
) => [
  {
    label: "Tên đăng nhập",
    value:
      getUsername(user),
  },
  {
    label: "Tên hiển thị",
    value:
      getDisplayName(user),
  },
  {
    label: "Email",
    value:
      user?.email || "Chưa thiết lập",
  },
  {
    label:
      "Chuỗi ngày Tarot Hằng Ngày",
    value: `${Number(user?.daily_tarot_streak ?? 0) || 0} ngày`,
  },
];

export default function UserProfile({
  isOpen,
  onClose,
  user = null,
}) {
  const navigate =
    useNavigate();

  const displayName =
    getDisplayName(user);

  const email =
    user?.email || "";

  const avatarUrl =
    getAvatarUrl(user);

  const infoRows =
    getInfoRows(user);

  const handleLogout = () => {
    localStorage.removeItem(
      "token"
    );
    localStorage.removeItem(
      "access_token"
    );
    localStorage.removeItem(
      "user"
    );

    sessionStorage.removeItem(
      "token"
    );
    sessionStorage.removeItem(
      "access_token"
    );
    sessionStorage.removeItem(
      "user"
    );

    // Xoá cache lịch sử trải bài để user kế tiếp trên cùng máy không thấy phiên của user trước.
    clearCachedSessions();

    navigate("/");
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background:
            "rgba(0,0,0,0.28)",
          backdropFilter:
            "blur(6px)",
          WebkitBackdropFilter:
            "blur(6px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents:
            isOpen ? "auto" : "none",
          transition:
            "0.35s ease",
          zIndex: 90,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "20%",
          minWidth: "min(340px, 100vw)",
          height: "100vh",
          background:
            "linear-gradient(to bottom, rgba(15,10,30,0.88), rgba(8,5,18,0.94))",
          borderLeft:
            "1px solid rgba(168,85,247,0.14)",
          backdropFilter:
            "blur(24px)",
          WebkitBackdropFilter:
            "blur(24px)",
          boxShadow:
            "-20px 0 60px rgba(0,0,0,0.45)",
          transform: isOpen
            ? "translateX(0)"
            : "translateX(100%)",
          transition:
            "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 100,
          padding: "28px",
          boxSizing:
            "border-box",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Nút đóng (trước đây không có → panel che backdrop, bị kẹt trên điện thoại). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          style={{
            position: "fixed",
            top: "calc(12px + env(safe-area-inset-top, 0px))",
            right: "12px",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(20,12,36,0.65)",
            color: "#fff",
            fontSize: "20px",
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 5,
          }}
        >
          ✕
        </button>

        <div
          style={{
            position: "absolute",
            width: "280px",
            height: "280px",
            background:
              "radial-gradient(circle, rgba(168,85,247,0.24), transparent 70%)",
            top: "-120px",
            right: "-80px",
            filter: "blur(20px)",
            pointerEvents:
              "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection:
              "column",
            alignItems:
              "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "104px",
              height: "104px",
              borderRadius: "50%",
              overflow: "hidden",
              border:
                "2px solid rgba(216,180,254,0.4)",
              boxShadow:
                "0 0 24px rgba(192,132,252,0.25)",
              background:
                "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <img
              src={avatarUrl}
              alt={displayName}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                objectFit: "cover",
                objectPosition:
                  "center",
              }}
            />
          </div>

          <div
            style={{
              marginTop: "18px",
              color: "#ffffff",
              fontSize: "1.5rem",
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {displayName}
          </div>

          {email && (
            <div
              style={{
                marginTop: "8px",
                color:
                  "rgba(255,255,255,0.68)",
                fontSize: "0.92rem",
                wordBreak:
                  "break-word",
              }}
            >
              {email}
            </div>
          )}
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 2,
            marginTop: "28px",
            padding: "18px",
            borderRadius: "18px",
            background:
              "rgba(255,255,255,0.04)",
            border:
              "1px solid rgba(168,85,247,0.14)",
            color: "#efe7ff",
            display: "flex",
            flexDirection:
              "column",
            gap: "14px",
          }}
        >
          {infoRows.map((row) => (
            <div
              key={row.label}
              style={{
                paddingBottom:
                  "12px",
                borderBottom:
                  "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  letterSpacing:
                    "0.04em",
                  textTransform:
                    "uppercase",
                  color:
                    "rgba(255,255,255,0.52)",
                  marginBottom: "6px",
                }}
              >
                {row.label}
              </div>

              <div
                style={{
                  fontSize: "0.98rem",
                  fontWeight: 600,
                  color: "#ffffff",
                  wordBreak:
                    "break-word",
                }}
              >
                {row.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "28px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "18px",
              border:
                "1px solid rgba(239,68,68,0.18)",
              background:
                "rgba(239,68,68,0.08)",
              color: "#fca5a5",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              transition:
                "0.25s ease",
              backdropFilter:
                "blur(12px)",
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </>
  );
}
