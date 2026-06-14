import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "catarot_app_settings";

const DEFAULT_SETTINGS = {
  mascotSoundEnabled: true,
  cursorEffectsEnabled: true,
  speechPlaybackEnabled: true,
};

const STRINGS = {
  common_or: "Hoặc",
  common_back: "Quay lại",
  common_close: "Đóng",
  settings_title: "Cài đặt",
  settings_sound: "Âm thanh mèo",
  settings_cursor: "Hiệu ứng cursor",
  settings_speech: "Đọc phản hồi",
  settings_open: "Mở cài đặt",
  mascot_message: "Chào mừng bạn trở lại.",
  mascot_tools: "Công cụ hỗ trợ",
  mascot_draw: "Rút một lá bài hỗ trợ",
  mascot_settings: "Cài đặt",
  mascot_redraw: "Rút lại",
  mascot_download: "Tải xuống",
  mascot_no_cards: "Không có lá bài tarot nào khả dụng.",
  guide_title: "HƯỚNG DẪN SỬ DỤNG CATAROT",
  nav_reading: "Xem Bài",
  nav_reflection_history: "Lịch sử chiêm nghiệm",
  nav_reading_history: "Lịch sử trải bài",
  nav_tarot: "Tarot",
  nav_what_is_tarot: "Tarot là gì?",
  nav_catarot: "Catarot",
  nav_contact: "Liên hệ",
  nav_more_info: "Thông tin thêm",
  overlay_what_is_tarot: "TAROT LÀ GÌ?",
  overlay_catarot: "CATAROT",
  contact_title: "Liên Hệ",
  contact_discord: "Discord",
  contact_email: "Email",
  contact_github: "Github",
  contact_advisor: "GVHD: ThS. Trần Tuấn Dũng",
  history_title: "Lịch Sử Xem Bài",
  history_loading: "Đang tải các phiên...",
  history_load_failed: "Không tải được lịch sử xem bài",
  history_untitled: "Trải bài chưa đặt tên",
  reflection_title: "Lịch sử chiêm nghiệm",
  reflection_loading: "Đang tải chiêm nghiệm...",
  reflection_empty:
    "Chưa có chiêm nghiệm nào. Hãy lưu một chiêm nghiệm từ kết quả Tarot Hằng Ngày của bạn để xem tại đây.",
  login_title: "Chào mừng trở lại!",
  login_google: "Đăng nhập với Google",
  login_email: "Email của bạn",
  login_password: "Mật khẩu",
  login_remember: "Ghi nhớ đăng nhập",
  login_forgot: "Quên mật khẩu?",
  login_submit: "Đăng nhập",
  login_submitting: "Đang đăng nhập...",
  login_no_account: "Chưa có tài khoản?",
  login_signup: "Đăng ký",
  login_missing: "Vui lòng nhập đầy đủ thông tin",
  auth_password_invalid:
    "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ cái và số.",
  login_success: "Chào mừng trở lại!",
  login_invalid: "Email hoặc mật khẩu không đúng",
  signup_title: "Bắt đầu nào",
  signup_google: "Đăng ký với Google",
  signup_email: "Email của bạn",
  signup_username: "Tên đăng nhập",
  signup_password: "Mật khẩu",
  signup_confirm_password: "Xác nhận mật khẩu",
  signup_submit: "Đăng ký",
  signup_submitting: "Đang tạo...",
  signup_success: "Tạo tài khoản thành công!",
  signup_missing: "Vui lòng nhập đầy đủ thông tin",
  signup_password_mismatch: "Mật khẩu xác nhận không khớp",
  signup_username_short: "Tên đăng nhập phải có ít nhất 3 ký tự",
  signup_failed: "Đăng ký thất bại",
  signup_welcome: "Chào mừng bạn!",
  forgot_title: "Quên mật khẩu",
  forgot_desc: "Đừng lo, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn",
  forgot_email: "Nhập email",
  forgot_submit: "Gửi",
  forgot_submitting: "Đang gửi...",
  forgot_missing: "Vui lòng nhập email của bạn",
  forgot_success: "Nếu email tồn tại, hướng dẫn đặt lại đã được gửi.",
  forgot_failed: "Đã có lỗi xảy ra. Vui lòng thử lại.",
};

const AppSettingsContext = createContext(null);

function readStoredSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(readStoredSettings);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = "vi";
    document.body.classList.toggle(
      "cursor-effects-disabled",
      !settings.cursorEffectsEnabled
    );
  }, [settings.cursorEffectsEnabled]);

  const value = useMemo(() => {
    return {
      settings,
      setSettings,
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
      t: (key, fallback) => STRINGS[key] ?? fallback ?? key,
    };
  }, [settings]);

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return context;
}
