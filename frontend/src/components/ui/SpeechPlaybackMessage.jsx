import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";

import { synthesizeSpeech } from "../../services/speechService";
import "./SpeechPlaybackMessage.css";

function renderMarkdownLink(props) {
  return <a {...props} target="_blank" rel="noopener noreferrer" />;
}

// Rehype plugin: bọc MỖI TỪ trong <span class="kw"> để karaoke tô sáng từng từ. Chạy SAU khi
// markdown đã parse nên không còn dấu cú pháp → luôn render markdown HỢP LỆ. Bỏ qua code/pre.
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
              out.push({ type: "text", value: part });
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

const FIRST_CHUNK_CHARS = 320; // đoạn đầu nhỏ → có tiếng nhanh (~vài giây)
const MAX_CHUNK_CHARS = 600; // các đoạn sau (đều DƯỚI TTS_MAX_CHARS backend → không bị cắt)
const MIN_CUT = 160; // không cắt thành đoạn quá ngắn

// Chia text thành các đoạn tại ranh giới (xuống dòng > dấu câu > khoảng trắng) để ĐỌC FULL
// mà vẫn nhanh: tổng hợp đoạn đầu rồi phát ngay, các đoạn sau tổng hợp ngầm khi đang đọc.
// Trả [{ text, start, len }] với start = vị trí ký tự trong text gốc (để karaoke ánh xạ).
function splitIntoChunks(text) {
  const chunks = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const size = chunks.length === 0 ? FIRST_CHUNK_CHARS : MAX_CHUNK_CHARS;
    let end = Math.min(i + size, n);
    if (end < n) {
      const slice = text.slice(i, end);
      const nl = slice.lastIndexOf("\n");
      const punct = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("; ")
      );
      const sp = slice.lastIndexOf(" ");
      const cut =
        nl >= MIN_CUT ? nl + 1 : punct >= MIN_CUT ? punct + 2 : sp >= MIN_CUT ? sp + 1 : slice.length;
      end = i + cut;
    }
    const piece = text.slice(i, end);
    if (piece.trim()) chunks.push({ text: piece, start: i, len: piece.length });
    i = end;
  }
  return chunks.length ? chunks : [{ text, start: 0, len: text.length }];
}

// Luận giải LUÔN hiển thị đầy đủ. Bấm loa: đọc HẾT bài bằng cách chia đoạn — tổng hợp đoạn đầu
// phát ngay, prefetch đoạn kế khi đang đọc → không đợi lâu, không timeout. Karaoke tô sáng dần
// theo vị trí ký tự toàn cục (xuyên các đoạn); thao tác trực tiếp DOM, không re-render.
export default function SpeechPlaybackMessage({
  text = "",
  speechKey = "",
  replaySignal = 0,
}) {
  const safeText = String(text || "");
  const containerRef = useRef(null);
  const audioRef = useRef(null); // Audio đang phát
  const chunkUrlsRef = useRef([]); // mọi blob URL đã tạo → revoke khi dừng
  const rafRef = useRef(null);
  const wordsRef = useRef([]); // các <span class="kw"> theo thứ tự
  const totalWordsRef = useRef(0);
  const wordsCollectedRef = useRef(false); // đã thu thập span chưa (phân biệt với "0 từ")
  const revealedRef = useRef(0); // số từ đã tô sáng
  // Mốc replaySignal đã xử lý — khởi tạo = giá trị hiện tại để mount/remount KHÔNG tự phát.
  const lastReplayRef = useRef(replaySignal);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  // Cảnh báo mềm từ backend (vd cắt bớt) — gần như không xảy ra nữa vì mỗi đoạn < ngưỡng.
  const [warningNote, setWarningNote] = useState("");
  const [isPlaying, setIsPlaying] = useState(false); // đang phát → hiện nút Dừng
  // Tăng để YÊU CẦU dừng: effect chạy lại → cleanup dừng audio; lần chạy mới willPlay=false
  // (replaySignal không đổi) nên KHÔNG tự phát lại → dừng sạch mà không khởi động lại.
  const [stopCounter, setStopCounter] = useState(0);

  const handleStop = () => {
    setIsPlaying(false);
    setStopCounter((c) => c + 1);
  };

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
      totalWordsRef.current = 0;
      wordsRef.current = [];
      wordsCollectedRef.current = false;
    };

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
      chunkUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      chunkUrlsRef.current = [];
      clearHighlight();
    };

    stopPlayback();

    const isFreshReplay = replaySignal > lastReplayRef.current;
    lastReplayRef.current = replaySignal;
    const willPlay = isFreshReplay && Boolean(safeText) && Boolean(speechKey);

    const collectWords = () => {
      const container = containerRef.current;
      if (!container) return;
      wordsRef.current = Array.from(container.querySelectorAll("span.kw"));
      totalWordsRef.current = wordsRef.current.length;
      revealedRef.current = 0;
      wordsCollectedRef.current = true;
      if (totalWordsRef.current > 0) container.classList.add("karaoke-active");
    };

    const highlightTo = (count) => {
      const target = Math.min(totalWordsRef.current, Math.max(0, count));
      while (revealedRef.current < target) {
        const word = wordsRef.current[revealedRef.current];
        if (word) word.classList.add("kw--spoken");
        revealedRef.current += 1;
      }
    };

    (async () => {
      // Tách khỏi luồng đồng bộ của effect (tránh setState đồng bộ trong effect body).
      await Promise.resolve();
      if (isCancelled) return;
      setWarningNote("");
      if (!willPlay) {
        setIsPlaying(false);
        return;
      }

      const chunks = splitIntoChunks(safeText);
      const totalChars = Math.max(1, safeText.length);
      setIsSynthesizing(true);
      setIsPlaying(true);

      // Tổng hợp 1 đoạn → Audio (null nếu bị huỷ giữa chừng).
      const synthChunk = async (chunkText) => {
        const { audioBlob, warnings } = await synthesizeSpeech(chunkText);
        if (isCancelled) return null;
        if (warnings && warnings.length > 0) setWarningNote(warnings.join(" • "));
        const url = URL.createObjectURL(audioBlob);
        chunkUrlsRef.current.push(url);
        return new Audio(url);
      };

      // Phát 1 đoạn + tô sáng theo vị trí ký tự TOÀN CỤC; resolve khi đoạn kết thúc.
      const playChunk = (audio, chunk) =>
        new Promise((resolve, reject) => {
          let karaokeStarted = false;
          let watchdog = null;
          let lastCt = -1;
          const armWatchdog = () => {
            if (watchdog) clearTimeout(watchdog);
            // Không tiến triển 20s (play() treo / 'ended' không bắn trên mạng chập chờn) →
            // bỏ đoạn, báo lỗi thay vì treo cả hàng đợi.
            watchdog = setTimeout(
              () => finish(() => reject(new Error("audio stalled"))),
              20000
            );
          };
          const finish = (done) => {
            if (watchdog) {
              clearTimeout(watchdog);
              watchdog = null;
            }
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onError);
            if (rafRef.current) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            done();
          };
          const onEnded = () => finish(resolve);
          const onError = () => finish(() => reject(new Error("audio decode error")));
          audio.addEventListener("ended", onEnded);
          audio.addEventListener("error", onError);

          const tick = () => {
            if (isCancelled || audioRef.current !== audio) {
              audio.pause(); // huỷ/đã chuyển đoạn → dừng hẳn, không để phát ngầm
              finish(resolve);
              return;
            }
            const dur = audio.duration;
            // Chỉ tô sáng khi đã có metadata VÀ audio thật sự chạy (currentTime>0).
            if (!Number.isFinite(dur) || dur <= 0 || audio.currentTime <= 0) {
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
            if (audio.currentTime !== lastCt) {
              lastCt = audio.currentTime; // có tiến triển → gia hạn watchdog
              armWatchdog();
            }
            if (!karaokeStarted) {
              karaokeStarted = true;
              setIsSynthesizing(false); // có tiếng đoạn đầu → tắt spinner
              if (!wordsCollectedRef.current) collectWords(); // thu thập 1 lần
            }
            const p = Math.min(1, audio.currentTime / dur);
            const globalFrac = Math.min(1, (chunk.start + chunk.len * p) / totalChars);
            highlightTo(Math.round(totalWordsRef.current * globalFrac));
            rafRef.current = requestAnimationFrame(tick);
          };

          audioRef.current = audio;
          armWatchdog();
          audio
            .play()
            .then(() => {
              if (isCancelled) {
                audio.pause();
                finish(resolve);
                return;
              }
              rafRef.current = requestAnimationFrame(tick);
            })
            .catch((err) => finish(() => reject(err)));
        });

      try {
        // 1 đoạn "đi trước": prefetch đoạn kế trong lúc đoạn hiện tại đang phát.
        let nextAudioPromise = synthChunk(chunks[0].text);
        for (let idx = 0; idx < chunks.length; idx += 1) {
          const audio = await nextAudioPromise;
          if (isCancelled) return;
          if (!audio) throw new Error("Không tạo được giọng đọc.");

          nextAudioPromise =
            idx + 1 < chunks.length ? synthChunk(chunks[idx + 1].text) : Promise.resolve(null);
          // Bắt sẵn lỗi prefetch để không bị "unhandled rejection" khi đang phát đoạn này;
          // lỗi thật sẽ nổi lại khi `await nextAudioPromise` ở vòng sau.
          nextAudioPromise.catch(() => {});

          await playChunk(audio, chunks[idx]);
          if (isCancelled) return;
        }
        stopPlayback(); // đọc xong hết → bỏ mờ + giải phóng mọi blob ngay (không đợi lần dừng sau)
        setIsPlaying(false);
      } catch (error) {
        console.error("Speech playback failed", error);
        if (!isCancelled) {
          stopPlayback();
          const status = error?.response?.status;
          toast.error(
            status === 429
              ? "Bạn bấm đọc hơi nhanh, thử lại sau giây lát."
              : status === 503
                ? "Giọng đọc tạm thời không khả dụng, thử lại sau."
                : "Không tạo được giọng đọc, vui lòng thử lại."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsSynthesizing(false);
          setIsPlaying(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
      stopPlayback();
    };
  }, [replaySignal, safeText, speechKey, stopCounter]);

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

      {(isPlaying || isSynthesizing) && (
        <button
          type="button"
          onClick={handleStop}
          aria-label="Dừng đọc"
          style={{
            marginTop: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(20,10,35,0.6)",
            color: "#f3d0ff",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ⏹ Dừng đọc
        </button>
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
