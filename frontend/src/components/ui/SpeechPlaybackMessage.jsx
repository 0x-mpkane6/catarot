import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { synthesizeSpeech } from "../../services/speechService";

function renderMarkdownLink(props) {
  return (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
    />
  );
}

// Luận giải LUÔN hiển thị đầy đủ ngay. Giọng đọc (TTS) là TÙY CHỌN: chỉ tổng hợp + phát khi
// người dùng BẤM nút loa (replaySignal tăng) — KHÔNG auto-play.
//
// Vì sao bỏ auto-play: TTS tiếng Việt (facebook/mms-tts-vie) chạy trên CPU rất chậm (vài chục
// giây cho một luận giải dài); auto-play vừa tốn tài nguyên vừa bị trình duyệt CHẶN (không có
// thao tác người dùng nên audio không phát được). Khi đang tổng hợp có chỉ báo "đang tạo giọng
// đọc" để không bị tưởng đơ/hỏng.
export default function SpeechPlaybackMessage({
  text = "",
  speechKey = "",
  replaySignal = 0,
}) {
  const safeText = String(text || "");
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  // Mốc replaySignal đã xử lý — khởi tạo = giá trị hiện tại để mount/remount (kế thừa signal
  // khi đổi phiên) KHÔNG tự phát; chỉ phát khi signal TĂNG (người dùng bấm loa).
  const lastReplayRef = useRef(replaySignal);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  useEffect(() => {
    // Dọn audio lần trước.
    const previousAudio = audioRef.current;
    if (previousAudio) {
      previousAudio.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }

    const isFreshReplay = replaySignal > lastReplayRef.current;
    lastReplayRef.current = replaySignal;
    if (!isFreshReplay || !safeText || !speechKey) {
      return undefined;
    }

    let isCancelled = false;
    setIsSynthesizing(true);

    (async () => {
      try {
        const { audioBlob } = await synthesizeSpeech(safeText);
        if (isCancelled) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        await audio.play();
      } catch (error) {
        // TTS lỗi hoặc trình duyệt chặn phát: bỏ qua giọng đọc, chữ vẫn hiển thị đầy đủ.
        console.error("Speech playback failed", error);
      } finally {
        if (!isCancelled) setIsSynthesizing(false);
      }
    })();

    return () => {
      isCancelled = true;
      const activeAudio = audioRef.current;
      if (activeAudio) {
        activeAudio.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = "";
      }
    };
  }, [replaySignal, safeText, speechKey]);

  return (
    <>
      <ReactMarkdown
        components={{
          a: renderMarkdownLink,
        }}
      >
        {safeText}
      </ReactMarkdown>

      {isSynthesizing && (
        <div
          aria-live="polite"
          style={{
            marginTop: "8px",
            fontSize: "0.82rem",
            fontStyle: "italic",
            color: "rgba(196,181,253,0.92)",
          }}
        >
          🔊 Đang tạo giọng đọc… (có thể mất vài chục giây)
        </div>
      )}
    </>
  );
}
