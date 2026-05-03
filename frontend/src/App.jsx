import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import CommunityPage from "./pages/CommunityPage";
import DailyCardPage from "./pages/DailyCardPage";
import DreamJournalPage from "./pages/DreamJournalPage";
import DuoReadingPage from "./pages/DuoReadingPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import ReadingRoomPage from "./pages/ReadingRoomPage";
import RegisterPage from "./pages/RegisterPage";
import TimeCapsulePage from "./pages/TimeCapsulePage";
import { useAuthStore } from "./stores/authStore";

export default function App() {
  const restore = useAuthStore((state) => state.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LandingPage />} />
        <Route path="/reading" element={<ReadingRoomPage />} />
        <Route path="/daily-card" element={<DailyCardPage />} />
        <Route path="/dream-journal" element={<DreamJournalPage />} />
        <Route path="/duo" element={<DuoReadingPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/time-capsule" element={<TimeCapsulePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
