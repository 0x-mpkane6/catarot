import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

import { useAppSettings } from "../../context/AppSettingsContext";
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

// Luận giải LUÔN hiển thị đầy đủ ngay khi có nội dung. Giọng đọc (TTS) chỉ là lớp phụ:
// nếu bật thì phát NỀN, KHÔNG chặn/ẩn chữ.
//
// Trước đây component "gõ dần" chữ theo tiến độ audio và để TRỐNG chữ trong lúc tổng hợp
// giọng. TTS tiếng Việt trên CPU rất chậm (vài chục giây cho một luận giải dài) nên người
// dùng thấy bài đã hiện nhưng phần luận giải trống trơn — tưởng lỗi. Bỏ hẳn cơ chế đó.
export default function SpeechPlaybackMessage({
  text = "",
  autoPlay = false,
  speechKey = "",
  replaySignal = 0,
}) {
  const { settings } = useAppSettings();
  const safeText = String(text || "");
  const shouldAutoPlay = autoPlay && settings.speechPlaybackEnabled;

  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  // Mốc replaySignal đã xử lý. Khởi tạo = replaySignal hiện tại để KHÔNG tự phát khi component
  // mount/remount với một replaySignal kế thừa (vd ChatConversation tái dùng instance theo
  // index khi đổi phiên lịch sử). Chỉ phát lại khi user thực sự BẤM loa (replaySignal TĂNG),
  // không phải khi nội dung (safeText) đổi.
  const lastReplayRef = useRef(replaySignal);

  useEffect(() => {
    // Dọn audio của lần phát trước (đổi nội dung hoặc bấm phát lại).
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

    // Phát khi: autoplay (giọng bật) HOẶC user vừa bấm loa. KHÔNG phát chỉ vì replaySignal
    // còn >0 từ lần trước.
    const shouldPlay = Boolean(
      safeText && speechKey && (shouldAutoPlay || isFreshReplay)
    );
    if (!shouldPlay) return undefined;

    let isCancelled = false;

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
        // TTS lỗi hoặc trình duyệt chặn autoplay: bỏ qua giọng đọc, chữ vẫn hiển thị đầy đủ.
        console.error("Speech playback failed", error);
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
  }, [replaySignal, safeText, speechKey, shouldAutoPlay]);

  return (
    <ReactMarkdown
      components={{
        a: renderMarkdownLink,
      }}
    >
      {safeText}
    </ReactMarkdown>
  );
}
