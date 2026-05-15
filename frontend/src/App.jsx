import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import SigninPage from "./pages/SigninPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

import SplashCursor from "./components/common/SplashCursor";

import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      <SplashCursor
        DENSITY_DISSIPATION={3.5}
        VELOCITY_DISSIPATION={2}
        PRESSURE={0.1}
        CURL={3}
        SPLAT_RADIUS={0.2}
        SPLAT_FORCE={10000}
        COLOR_UPDATE_SPEED={10}
        SHADING
        RAINBOW_MODE={false}
        COLOR="#A855F7"
      />

        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "rgba(20, 8, 35, 0.92)",
              color: "#fff",
              border: "1px solid rgba(168,85,247,0.25)",
              backdropFilter: "blur(12px)",

              padding: "16px 20px",
              borderRadius: "16px",

              boxShadow:
                "0 0 30px rgba(168,85,247,0.18)",
            },
          }}
        />

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signin" element={<SigninPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;