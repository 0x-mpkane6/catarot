import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SigninPage from "./pages/SigninPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* landing */}
        <Route path="/" element={<LandingPage />} />

        {/* auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SigninPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;