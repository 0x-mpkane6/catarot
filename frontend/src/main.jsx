import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppSettingsProvider } from './context/AppSettingsContext.jsx'
import { isDevPreview, DEV_USER } from './lib/devPreview'

// CHỈ DEV: chế độ xem thử — giả đăng nhập để xem màn /home ở khổ điện thoại.
// import.meta.env.DEV = false ở bản production → nhánh này bị loại hoàn toàn.
if (import.meta.env.DEV && isDevPreview()) {
  localStorage.setItem('token', 'dev-preview-token')
  localStorage.setItem('user', JSON.stringify(DEV_USER))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppSettingsProvider>
      <App />
    </AppSettingsProvider>
  </StrictMode>,
)

// PWA: đăng ký service worker (chỉ ở bản production để không cản trở khi dev).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Tự cập nhật cho app đã cài (TWA/PWA): khi service worker MỚI giành quyền điều khiển
  // (sau skipWaiting + clients.claim trong sw.js), reload 1 lần để nạp shell + asset mới —
  // hết cảnh "kẹt bản cũ" phải xóa cache thủ công. Bỏ qua lần cài SW ĐẦU TIÊN (chưa từng có
  // controller) để không reload vô cớ; cờ refreshing chống reload lặp.
  let refreshing = false
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return
    refreshing = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
