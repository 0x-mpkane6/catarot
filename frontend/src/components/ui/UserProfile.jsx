export default function UserProfile({
  isOpen,
  onClose,
  username = "User",
}) {
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

        {/* empty content */}
        <div
          style={{
            marginTop: "40px",

            width: "100%",
            height: "180px",

            borderRadius: "22px",

            border:
              "1px solid rgba(255,255,255,0.06)",

            background:
              "rgba(255,255,255,0.025)",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            color: "rgba(255,255,255,0.35)",

            fontSize: "0.95rem",

            backdropFilter: "blur(12px)",
          }}
        >
          Empty profile card
        </div>
      </div>
    </>
  );
}