import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";

import { synthesizeSpeech } from "../../services/speechService";
import "./SpeechPlaybackMessage.css";

function renderMarkdownLink(props) {
  return <a {...props} target="_blank" rel="noopener noreferrer" />;
}

// Rehype plugin: bọc MỖI TỪ (cụm không phải khoảng trắng) trong <span class="kw"> để karaoke
// tô sáng được từng từ. Chạy SAU khi markdown đã parse nên không còn dấu cú pháp (** ## …),
// → luôn render markdown HỢP LỆ (hết hẳn chuyện lòi '*' do cắt chuỗi giữa chừng).
// Bỏ qua nội dung trong code/pre để không phá khoảng trắng mã.
function rehypeKaraokeWords() {
  return (tree) => {
    const wrap = (node) => {
      if (!node.children || !Array.isArray(node.children)) return;
      if (node.type === "element" && (node.tagName === "code" || node.tagName === "pre")) {
        return;
      }
      const out = [];
      for (const child of node.children) {
        if (child.type === "text") {
          for (const part of child.value.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
              out.push({ type: "text", value: part }); // giữ khoảng trắng để chữ vẫn xuống dòng
            } else {
              out.push({
                type: "element",
                tagName: "span",
                properties: { className: ["kw"] },
                children: [{ type: "text", value: part }],
              });
            }
          }
        } else {
          wrap(child);
          out.push(child);
        }
      }
      node.children = out;
    };
    wrap(tree);
  };
}

const REHYPE_PLUGINS = [rehypeKaraokeWords];
const MARKDOWN_COMPONENTS = { a: renderMarkdownLink };

// Luận giải LUÔN hiển thị đầy đủ. Khi người dùng BẤM nút loa: tổng hợp giọng (edge-tts) rồi
// vừa phát vừa TÔ SÁNG DẦN từng từ theo tiến độ audio (phần chưa đọc làm mờ). Chữ KHÔNG bao
// giờ biến mất → không gây cảm giác lỗi. Tô sáng làm trực tiếp trên DOM (không re-render).
export default function SpeechPlaybackMessage({
  text = "",
  speechKey = "",
  replaySignal = 0,
}) {
  const safeText = String(text || "");
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const endedHandlerRef = useRef(null);
  const rafRef = useRef(null);
  const wordsRef = useRef([]); // các <span class="kw"> theo thứ tự văn bản
  const revealedRef = useRef(0); // số từ đã tô sáng
  // Tỉ lệ phần văn bản audio THỰC SỰ đọc (chống lệch khi văn bản dài bị cắt bớt). Mặc định 1.
  const spokenFractionRef = useRef(1);
  // Mốc replaySignal đã xử lý — khởi tạo = giá trị hiện tại để mount/remount KHÔNG tự phát.
  const lastReplayRef = useRef(replaySignal);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  // Cảnh báo mềm từ backend (vd: bài quá dài bị cắt khi đọc) — hiện dưới luận giải.
  const [warningNote, setWarningNote] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const clearHighlight = () => {
      const container = containerRef.current;
      if (container) {
        container.classList.remove("karaoke-active");
        container
          .querySelectorAll("span.kw.kw--spoken")
          .forEach((w) => w.classList.remove("kw--spoken"));
      }
      revealedRef.current = 0;
    };

    const stopPlayback = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const activeAudio = audioRef.current;
      if (activeAudio) {
        if (endedHandlerRef.current) {
          activeAudio.removeEventListener("ended", endedHandlerRef.current);
          endedHandlerRef.current = null;
        }
        activeAudio.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = "";
      }
      clearHighlight();
    };

    stopPlayback();

    const isFreshReplay = replaySignal > lastReplayRef.current;
    lastReplayRef.current = replaySignal;
    const willPlay = isFreshReplay && Boolean(safeText) && Boolean(speechKey);

    (async () => {
      // Tách khỏi luồng đồng bộ của effect (tránh setState đồng bộ trong effect body).
      await Promise.resolve();
      if (isCancelled) return;
      setWarningNote(""); // luận giải mới / không phát → xoá cảnh báo cũ
      if (!willPlay) return;

      setIsSynthesizing(true);

      try {
        const { audioBlob, spokenEnd, warnings } = await synthesizeSpeech(safeText);
        if (isCancelled) return;
        // Cảnh báo mềm (vd cắt bớt văn bản khi đọc) → cho người dùng biết thay vì im lặng.
        if (warnings && warnings.length > 0) setWarningNote(warnings.join(" • "));

        // spokenEnd = số ký tự văn bản gốc audio đọc tới; quy về tỉ lệ để ánh xạ sang số TỪ.
        const validEnd =
          Number.isFinite(spokenEnd) && spokenEnd > 0
            ? Math.min(spokenEnd, safeText.length)
            : safeText.length;
        spokenFractionRef.current = Math.min(1, validEnd / Math.max(1, safeText.length));

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        const onEnded = () => {
          if (!isCancelled && audioRef.current === audio) clearHighlight(); // xong → sáng đều
        };
        endedHandlerRef.current = onEnded;
        audio.addEventListener("ended", onEnded);

        let started = false;
        const startKaraoke = () => {
          const container = containerRef.current;
          if (!container) return;
          // Thu thập span từ SAU khi React đã vẽ (rAF chạy sau paint nên DOM đã sẵn sàng).
          wordsRef.current = Array.from(container.querySelectorAll("span.kw"));
          // DOM chưa kịp commit (vd văn bản đổi lúc đang tổng hợp) → chưa kích hoạt, để chữ
          // hiện đầy đủ; tick sau sẽ thử lại (started vẫn false).
          if (wordsRef.current.length === 0) return;
          revealedRef.current = 0;
          container.classList.add("karaoke-active"); // làm mờ phần chưa đọc
          started = true;
        };

        const tick = () => {
          if (isCancelled || audioRef.current !== audio) return;
          const dur = audio.duration;
          // Chỉ tô sáng khi đã có metadata VÀ audio thật sự chạy (currentTime>0) — tránh làm mờ
          // sớm lúc còn đang nạp; cũng là lúc giọng bắt đầu cất tiếng.
          if (!Number.isFinite(dur) || dur <= 0 || audio.currentTime <= 0) {
            if (!audio.ended) rafRef.current = requestAnimationFrame(tick);
            return;
          }
          if (!started) startKaraoke();

          const total = wordsRef.current.length;
          const cap = Math.round(total * spokenFractionRef.current);
          const progress = Math.min(1, audio.currentTime / dur);
          const count = Math.min(total, Math.max(0, Math.round(cap * progress)));
          // Tô sáng tăng dần (chỉ động vào các từ mới vượt mốc → rẻ, không quét lại cả mảng).
          while (revealedRef.current < count) {
            const word = wordsRef.current[revealedRef.current];
            if (word) word.classList.add("kw--spoken");
            revealedRef.current += 1;
          }
          if (!audio.ended) rafRef.current = requestAnimationFrame(tick);
        };

        await audio.play();
        setIsSynthesizing(false); // tắt spinner kể cả khi bị huỷ ngay sau đây
        if (isCancelled) return;
        rafRef.current = requestAnimationFrame(tick);
      } catch (error) {
        // TTS lỗi / trình duyệt chặn phát: luận giải vẫn hiện đầy đủ, nhưng BÁO cho người dùng
        // (trước đây im lặng → nút loa như bị "chết").
        console.error("Speech playback failed", error);
        if (!isCancelled) {
          setIsSynthesizing(false);
          stopPlayback(); // dọn audio/blob/listener + bỏ tô sáng (không chỉ clearHighlight)
          const status = error?.response?.status;
          toast.error(
            status === 429
              ? "Bạn bấm đọc hơi nhanh, thử lại sau giây lát."
              : status === 503
                ? "Giọng đọc tạm thời không khả dụng, thử lại sau."
                : "Không tạo được giọng đọc, vui lòng thử lại."
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
      stopPlayback();
    };
  }, [replaySignal, safeText, speechKey]);

  return (
    <>
      <div ref={containerRef} className="karaoke-text">
        <ReactMarkdown rehypePlugins={REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {safeText}
        </ReactMarkdown>
      </div>

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

      {warningNote && (
        <div
          aria-live="polite"
          style={{
            marginTop: "8px",
            fontSize: "0.8rem",
            fontStyle: "italic",
            color: "rgba(251,191,36,0.92)",
          }}
        >
          ⚠️ {warningNote}
        </div>
      )}
    </>
  );
}
