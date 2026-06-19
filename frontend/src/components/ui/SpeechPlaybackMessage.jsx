import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { useAppSettings } from "../../context/AppSettingsContext";
import { synthesizeSpeech } from "../../services/speechService";

const REVEAL_INTERVAL_MS = 32;
const FALLBACK_MS_PER_TOKEN = 24;
const MIN_FALLBACK_DURATION_MS = 1800;

function renderMarkdownLink(props) {
  return (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
    />
  );
}

function getVisibleText(fullText, progress) {
  if (!fullText) return "";
  const tokens =
    fullText.match(/\S+\s*/g) || [];
  const nextCount = Math.max(
    1,
    Math.min(
      tokens.length,
      Math.floor(tokens.length * progress)
    )
  );
  return tokens
    .slice(0, nextCount)
    .join("")
    .trimEnd();
}

function cleanupPreviewMarkdown(value) {
  return String(value || "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\[[^\]]*$/, "")
    .replace(/\([^(]*$/, "")
    .replace(/\*\*[^*]*$/, "")
    .replace(/_[^_]*$/, "")
    .replace(/`[^`]*$/, "")
    .trimEnd();
}

export default function SpeechPlaybackMessage({
  text = "",
  autoPlay = false,
  speechKey = "",
  replaySignal = 0,
}) {
  const { settings } = useAppSettings();
  const safeText = String(text || "");
  const shouldAutoPlay = autoPlay && settings.speechPlaybackEnabled;
  const shouldReplay = replaySignal > 0;
  const shouldPlay = Boolean(
    safeText &&
    speechKey &&
    (shouldAutoPlay || shouldReplay)
  );
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const [displayText, setDisplayText] = useState(shouldPlay ? "" : safeText);
  const [isStreaming, setIsStreaming] = useState(Boolean(shouldPlay && safeText));

  // Định danh một "phiên phát": đổi khi đổi nội dung hoặc khi người dùng bấm phát lại.
  const playbackToken = `${speechKey}|${replaySignal}|${safeText.length}`;
  const [activeToken, setActiveToken] = useState(playbackToken);

  // Đặt lại trạng thái "gõ dần" NGAY TRONG RENDER khi mở một phiên phát mới — đây là mẫu
  // React khuyến nghị cho "reset state khi prop đổi" (KHÔNG đặt state đồng bộ trong effect).
  // Guard playbackToken !== activeToken đảm bảo không lặp render vô hạn.
  if (shouldPlay && playbackToken !== activeToken) {
    setActiveToken(playbackToken);
    setDisplayText("");
    setIsStreaming(true);
  }

  useEffect(() => {
    const previousAudio = audioRef.current;
    if (previousAudio) {
      previousAudio.pause();
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }

    if (!shouldPlay) {
      // Không phát: chỉ dọn audio (đã làm ở trên) rồi thoát. KHÔNG gọi setState đồng bộ ở
      // đây — trạng thái hiển thị được SUY RA từ prop qua `streaming` bên dưới, nên không
      // cần đặt lại state (tránh cascade render & lỗi react-hooks/set-state-in-effect).
      return undefined;
    }

    let isCancelled = false;
    let intervalId = null;
    let fallbackStartedAt = 0;
    const tokenCount =
      safeText.match(/\S+\s*/g)?.length || 1;
    let fallbackDurationMs = Math.max(
      MIN_FALLBACK_DURATION_MS,
      tokenCount * FALLBACK_MS_PER_TOKEN
    );

    const finishPlayback = () => {
      if (isCancelled) return;
      setDisplayText(safeText);
      setIsStreaming(false);
    };

    const updateVisibleText = () => {
      if (isCancelled) return;

      const audio = audioRef.current;
      let progress = 0;

      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        progress = audio.currentTime / audio.duration;
      } else if (fallbackStartedAt > 0) {
        progress = (Date.now() - fallbackStartedAt) / fallbackDurationMs;
      }

      if (progress >= 1) {
        finishPlayback();
        return;
      }

      setDisplayText((previous) => {
        const nextText = cleanupPreviewMarkdown(
          getVisibleText(
            safeText,
            Math.max(progress, 0)
          )
        );
        return nextText.length >= previous.length ? nextText : previous;
      });
    };

    const startRevealLoop = () => {
      fallbackStartedAt = Date.now();
      intervalId = window.setInterval(updateVisibleText, REVEAL_INTERVAL_MS);
    };

    const startSilentRevealFallback = () => {
      if (intervalId) return;
      startRevealLoop();
    };

    const startSpeechPlayback = async () => {
      try {
        const { audioBlob, warnings } = await synthesizeSpeech(safeText);
        if (isCancelled) return;

        if (warnings.length) {
          console.warn("TTS warnings:", warnings);
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.preload = "auto";

        audio.addEventListener("loadedmetadata", () => {
          if (audio.duration > 0) {
            fallbackDurationMs = audio.duration * 1000;
          }
        });

        audio.addEventListener("ended", finishPlayback);
        audio.addEventListener("error", finishPlayback);

        startRevealLoop();

        await audio.play();
      } catch (error) {
        console.error("Speech playback failed", error);
        startSilentRevealFallback();
      }
    };

    startSpeechPlayback();

    return () => {
      isCancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
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
  }, [replaySignal, safeText, shouldPlay, speechKey]);

  // Chỉ "gõ dần" khi thực sự đang phát; mọi trường hợp khác hiện full text. Suy ra từ prop
  // (shouldPlay) thay vì lệ thuộc state isStreaming có thể còn sót lại từ lần phát trước.
  const streaming = shouldPlay && isStreaming;
  if (!streaming) {
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

  return (
    <ReactMarkdown
      components={{
        a: renderMarkdownLink,
      }}
    >
      {displayText}
    </ReactMarkdown>
  );
}
