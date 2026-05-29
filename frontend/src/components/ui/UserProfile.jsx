import { useNavigate }
from "react-router-dom";

export default function UserProfile({
  isOpen,
  onClose,
  username = "User",
}) 
{
    const navigate =
    useNavigate();

  const handleLogout = () => {

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "access_token"
    );

    sessionStorage.removeItem(
      "token"
    );

    sessionStorage.removeItem(
      "access_token"
    );

    navigate("/");
  };
  return (
    <>
      {/* BACKDROP */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,

          background: "rgba(0,0,0,0.28)",

          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",

          opacity: isOpen ? 1 : 0,

          pointerEvents: isOpen ? "auto" : "none",

          transition: "0.35s ease",

          zIndex: 90,
        }}
      />

      {/* PANEL */}
      <div
        style={{
          position: "fixed",

          top: 0,
          right: 0,

          width: "20%",
          minWidth: "340px",

          height: "100vh",

          background:
            "linear-gradient(to bottom, rgba(15,10,30,0.88), rgba(8,5,18,0.94))",

          borderLeft:
            "1px solid rgba(168,85,247,0.14)",

          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",

          boxShadow:
            "-20px 0 60px rgba(0,0,0,0.45)",

          transform: isOpen
            ? "translateX(0)"
            : "translateX(100%)",

          transition:
            "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",

          zIndex: 100,

          padding: "28px",
          boxSizing: "border-box",

          overflow: "hidden",
        }}
      >
        {/* glow */}
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

            pointerEvents: "none",
          }}
        />

        {/* header */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              color: "#ffffff",

              fontSize: "2.2rem",
              fontWeight: 700,

              marginBottom: "6px",
            }}
          >
            Profile
          </div>

          <div
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "0.95rem",
            }}
          >
            @{username}
          </div>
        </div>

       {/* actions */}
<div
  style={{
    marginTop: "40px",

    display: "flex",

    flexDirection: "column",

    gap: "16px",
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

      transition: "0.25s ease",

      backdropFilter: "blur(12px)",
    }}

    onMouseEnter={(e) => {
      e.currentTarget.style.background =
        "rgba(239,68,68,0.14)";
    }}

    onMouseLeave={(e) => {
      e.currentTarget.style.background =
        "rgba(239,68,68,0.08)";
    }}
  >
    Log Out
  </button>

</div>
      </div>
    </>
  );
}