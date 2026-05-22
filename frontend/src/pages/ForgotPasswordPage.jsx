// eslint-disable-next-line no-unused-vars -- dùng dưới dạng <motion.div>
import { motion } from "framer-motion";
import ForgotPasswordForm from "../features/login/ForgotPasswordForm";

export default function ForgotPasswordPage() {
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

          width: "650px",
          height: "650px",

          borderRadius: "50%",

          background:
            "radial-gradient(circle, rgba(168,85,247,0.10), transparent 70%)",

          filter: "blur(80px)",

          pointerEvents: "none",
        }}
      />

      {/* animated forgot password card */}
      <motion.div
        initial={{
          y: -160,
          opacity: 0,
          scale: 0.94,
          filter: "blur(14px)",
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

          width: "440px",

          padding: "45px 35px",

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

            display: "flex",
            justifyContent: "center",
          }}
        >
          <ForgotPasswordForm />
        </div>
      </motion.div>
    </div>
  );
}