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

// Cắt phần markdown chưa đóng ở cuối chuỗi đang lộ dần để không render vỡ cú pháp
// (vd "**đậm" chưa có "**" đóng) trong lúc karaoke.
function cleanupPartialMarkdown(value) {
  return String(value || "")
    .replace(/\[[^\]]*$/, "")
    .replace(/\([^()]*$/, "")
    .replace(/\*\*[^*]*$/, "")
    .replace(/\*[^*]*$/, "")
    .replace(/`[^`]*$/, "")
    .replace(/#{1,6}\s*$/, "")
    .replace(/\s+$/, "");
}

// Luận giải hiển thị ĐẦY ĐỦ khi không phát. Khi người dùng BẤM nút loa: tổng hợp giọng (edge-tts,
// nhanh) rồi vừa phát vừa cho chữ HIỆN DẦN theo tiến độ audio (karaoke). Lộ theo TỪNG KÝ TỰ bằng
// requestAnimationFrame → mượt, không giật từng cụm. Hết audio → hiện lại đầy đủ.
export default function SpeechPlaybackMessage({
  text = "",
  speechKey = "",
  replaySignal = 0,
}) {
  const safeText = String(text || "");
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const rafRef = useRef(null);
  // Mốc replaySignal đã xử lý — khởi tạo = giá trị hiện tại để mount/remount KHÔNG tự phát.
  const lastReplayRef = useRef(replaySignal);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  // Số ký tự đang lộ. null = hiện ĐẦY ĐỦ (mặc định / khi không phát). Số = đang karaoke.
  const [revealCount, setRevealCount] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    const stopPlayback = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
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

    stopPlayback();

    const isFreshReplay = replaySignal > lastReplayRef.current;
    lastReplayRef.current = replaySignal;
    const willPlay =
      isFreshReplay && Boolean(safeText) && Boolean(speechKey);

    (async () => {
      // Tách khỏi luồng đồng bộ của effect (tránh setState đồng bộ trong effect body).
      await Promise.resolve();
      if (isCancelled) return;

      if (!willPlay) {
        setRevealCount(null); // hiện đầy đủ
        return;
      }

      setIsSynthesizing(true);
      setRevealCount(0); // bắt đầu karaoke từ rỗng

      try {
        const { audioBlob } = await synthesizeSpeech(safeText);
        if (isCancelled) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.addEventListener("ended", () => {
          if (!isCancelled) setRevealCount(null); // xong → hiện đầy đủ
        });

        const tick = () => {
          if (isCancelled || audioRef.current !== audio) return;
          const dur = audio.duration;
          const progress =
            Number.isFinite(dur) && dur > 0 ? audio.currentTime / dur : 0;
          const count = Math.min(
            safeText.length,
            Math.max(0, Math.round(safeText.length * progress))
          );
          setRevealCount(count);
          if (!audio.ended) {
            rafRef.current = requestAnimationFrame(tick);
          }
        };

        await audio.play();
        if (isCancelled) return;
        setIsSynthesizing(false);
        rafRef.current = requestAnimationFrame(tick);
      } catch (error) {
        // TTS lỗi / trình duyệt chặn phát: bỏ qua giọng đọc, hiện luận giải đầy đủ.
        console.error("Speech playback failed", error);
        if (!isCancelled) {
          setIsSynthesizing(false);
          setRevealCount(null);
        }
      }
    })();

    return () => {
      isCancelled = true;
      stopPlayback();
    };
  }, [replaySignal, safeText, speechKey]);

  const shown =
    revealCount === null
      ? safeText
      : cleanupPartialMarkdown(safeText.slice(0, revealCount));

  return (
    <>
      <ReactMarkdown
        components={{
          a: renderMarkdownLink,
        }}
      >
        {shown}
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
          🔊 Đang tạo giọng đọc…
        </div>
      )}
    </>
  );
}
