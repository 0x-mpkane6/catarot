import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import BackGroundMusic from "./components/common/BackGroundMusic";
import SplashCursor from "./components/common/SplashCursor";
import RouteTransition from "./components/transition/RouteTransition";
import CosmicVeil from "./components/transition/CosmicVeil";
import MysticLoader from "./components/ui/MysticLoader";
import { useAppSettings } from "./context/AppSettingsContext";

import { Toaster } from "react-hot-toast";

// Code-split: chỉ tải page khi user vào route đó để giảm bundle ban đầu.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const SigninPage = lazy(() => import("./pages/SigninPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

// Đọc token đăng nhập từ cả localStorage (ghi nhớ) lẫn sessionStorage (phiên), cùng thứ tự
// với services/api.js để tránh lệch.
function getStoredToken() {
  for (const storage of [localStorage, sessionStorage]) {
    const token =
      storage.getItem("token") || storage.getItem("access_token");
    if (token) return token;
  }
  return null;
}

// Guard điều hướng phía client: chưa đăng nhập mà vào /home thì đẩy về /login thay vì hiển thị
// trang chính ở trạng thái hỏng (không có user, lịch sử rỗng). Dữ liệu nhạy cảm vẫn được backend
// bảo vệ bằng 401 — đây chỉ là cải thiện UX/điều hướng.
function RequireAuth({ children }) {
  if (!getStoredToken()) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const { settings } = useAppSettings();

  return (
    <>
      <BackGroundMusic />

      {/* Host hiệu ứng chuyển cảnh trong trang — tự kích hoạt CHỈ trên mobile. */}
      <CosmicVeil />

      {settings.cursorEffectsEnabled && (
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
      )}

      <Toaster
        position="top-center"
        containerStyle={{
          // Đẩy toast xuống dưới thanh nav cố định (+ safe-area) để không che nav/nút.
          top: "calc(env(safe-area-inset-top, 0px) + 78px)",
        }}
        toastOptions={{
          style: {
            background: "rgba(20, 8, 35, 0.92)",
            color: "#fff",
            border: "1px solid rgba(168,85,247,0.25)",
            backdropFilter: "blur(12px)",
            padding: "16px 20px",
            borderRadius: "16px",
            boxShadow: "0 0 30px rgba(168,85,247,0.18)",
          },
        }}
      />

      <BrowserRouter>
        <RouteTransition>
          <Suspense fallback={<MysticLoader label="Đang mở cánh cổng" />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signin" element={<SigninPage />} />
              <Route
                path="/home"
                element={
                  <RequireAuth>
                    <HomePage />
                  </RequireAuth>
                }
              />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </Suspense>
        </RouteTransition>
      </BrowserRouter>
    </>
  );
}

export default App;
