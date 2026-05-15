import { motion } from "framer-motion";
import SigninForm from "../features/login/SigninForm.jsx";

export default function SigninPage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",

        display: "flex",
        justifyContent: "center",
        alignItems: "center",

        position: "relative",
        overflow: "hidden",

        background: `
          radial-gradient(circle at top left, rgba(168,85,247,0.18), transparent 30%),
          radial-gradient(circle at top right, rgba(236,72,153,0.12), transparent 25%),
          linear-gradient(to bottom, #050510, #090114, #020205)
        `,
      }}
    >
      {/* stars */}
      <div
        style={{
          position: "absolute",
          inset: 0,

          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",

          backgroundSize: "50px 50px",

          opacity: 0.06,

          pointerEvents: "none",
        }}
      />

      {/* ambient glow */}
      <div
        style={{
          position: "absolute",

          width: "700px",
          height: "700px",

          borderRadius: "50%",

          background:
            "radial-gradient(circle, rgba(168,85,247,0.12), transparent 70%)",

          filter: "blur(80px)",

          pointerEvents: "none",
        }}
      />

      {/* animated signup card */}
      <motion.div
        initial={{
          y: -180,
          opacity: 0,
          scale: 0.92,
          filter: "blur(16px)",
        }}
        animate={{
          y: 0,
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
        }}
        transition={{
          duration: 1.2,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          position: "relative",
          zIndex: 10,

          width: "500px",

          padding: "60px 45px",

          borderRadius: "32px",

          background: "rgba(18, 6, 35, 0.55)",

          backdropFilter: "blur(22px)",

          border: "1px solid rgba(255,255,255,0.05)",

          overflow: "hidden",

          boxShadow: `
            0 0 60px rgba(168,85,247,0.08),
            0 0 120px rgba(168,85,247,0.05)
          `,

          transform: "translateZ(0)",
        }}
      >
        {/* smooth border */}
        <div
          style={{
            position: "absolute",
            inset: 0,

            borderRadius: "32px",

            padding: "0.8px",

            background: `
              linear-gradient(
                135deg,
                rgba(168,85,247,0.22),
                rgba(236,72,153,0.06),
                rgba(168,85,247,0.18)
              )
            `,

            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",

            WebkitMaskComposite: "xor",

            pointerEvents: "none",

            opacity: 0.45,
          }}
        />

        {/* content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
          }}
        >
          <SigninForm />
        </div>
      </motion.div>
    </div>
  );
}