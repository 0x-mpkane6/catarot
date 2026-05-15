import { motion } from "framer-motion";
import LoginForm from "../features/login/LoginForm.jsx";

export default function LoginPage() {
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
            "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",

          backgroundSize: "50px 50px",

          opacity: 0.08,

          pointerEvents: "none",
        }}
      />

      {/* animated form */}
      <motion.div
        initial={{
          y: -120,
          opacity: 0,
          scale: 0.95,
          filter: "blur(12px)",
        }}
        animate={{
          y: 0,
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
        }}
        transition={{
          duration: 1.1,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          position: "relative",
          zIndex: 10,

          width: "485px",

          padding: "50px 40px",

          borderRadius: "28px",

          background: "rgba(20, 8, 35, 0.55)",

          backdropFilter: "blur(18px)",

          border: "1px solid rgba(255,255,255,0.08)",

          boxShadow: `
            0 0 40px rgba(168,85,247,0.18),
            inset 0 0 20px rgba(255,255,255,0.03)
          `,
        }}
      >
        <LoginForm />
      </motion.div>
    </div>
  );
}