import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { loginWithGoogle } from "../../services/authService";
import { useAppSettings } from "../../context/AppSettingsContext";
import googleIcon from "../../assets/images/auth/google.webp";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";

// index.html nạp GIS dạng async/defer nên component có thể mount trước khi script sẵn sàng.
// Hàm này đảm bảo window.google.accounts.id tồn tại trước khi khởi tạo.
function ensureGsiLoaded() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id);
      return;
    }

    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (window.google?.accounts?.id) {
        clearInterval(poll);
        resolve(window.google.accounts.id);
      } else if (tries > 50) {
        clearInterval(poll);
        reject(new Error("Hết thời gian chờ Google Identity Services"));
      }
    }, 100);

    // Nếu chưa có thẻ script (vd. bị chặn), tự chèn để tăng độ chắc chắn.
    if (!document.querySelector(`script[src="${GIS_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        clearInterval(poll);
        reject(new Error("Không tải được Google Identity Services"));
      };
      document.head.appendChild(script);
    }
  });
}

/**
 * Nút đăng nhập Google dùng chung cho LoginForm và SigninForm.
 * - Có VITE_GOOGLE_CLIENT_ID  → render nút Google chính thức (đáng tin cậy).
 * - Thiếu cấu hình / lỗi tải   → hiện nút dự phòng theo style hiện tại + thông báo.
 *
 * @param {(authResult: object) => void} props.onSuccess  Nhận { token, user, ... } sau khi đăng nhập.
 * @param {string} props.text         Kiểu chữ nút GIS: signin_with | signup_with | continue_with.
 * @param {string} props.fallbackClassName  className cho nút dự phòng (giữ giao diện cũ).
 * @param {string} props.fallbackLabel      Nhãn nút dự phòng.
 */
export default function GoogleLoginButton({
  onSuccess,
  text = "continue_with",
  fallbackClassName,
  fallbackLabel = "Google",
}) {
  const { t } = useAppSettings();
  const containerRef = useRef(null);
  // Giu onSuccess trong ref: LoginForm/SigninForm truyen handler inline (doi identity moi
  // lan render). Neu de onSuccess trong deps cua effect ben duoi thi MOI lan go phim se
  // huy + dung lai nut Google -> nhap nhay. Dung ref + deps chi [text] de render dung 1 lan.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);
  // GOOGLE_CLIENT_ID là hằng số lúc build → suy ra trạng thái ban đầu, tránh setState
  // đồng bộ trong effect (react-hooks/set-state-in-effect).
  const [unavailable, setUnavailable] = useState(!GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    let cancelled = false;

    ensureGsiLoaded()
      .then((idApi) => {
        if (cancelled || !containerRef.current) return;

        idApi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async ({ credential }) => {
            try {
              const res = await loginWithGoogle(credential);
              onSuccessRef.current?.(res);
            } catch (err) {
              console.error(err);
              toast.error(
                err?.response?.data?.detail || t("login_google")
              );
            }
          },
        });

        const width = Math.min(
          Math.max(containerRef.current.clientWidth || 320, 240),
          400
        );

        containerRef.current.innerHTML = "";
        idApi.renderButton(containerRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text,
          width,
          logo_alignment: "center",
        });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (unavailable) {
    return (
      <button
        type="button"
        className={fallbackClassName}
        onClick={() =>
          toast.error(
            GOOGLE_CLIENT_ID
              ? "Không tải được Google. Vui lòng thử lại sau."
              : t("login_google")
          )
        }
        title={
          GOOGLE_CLIENT_ID
            ? "Google Identity Services chưa sẵn sàng"
            : "Cần đặt VITE_GOOGLE_CLIENT_ID khi build frontend"
        }
      >
        <img
          src={googleIcon}
          alt="Google"
          width="20"
          height="20"
        />
        {fallbackLabel}
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        justifyContent: "center",
        minHeight: 44,
      }}
    />
  );
}
