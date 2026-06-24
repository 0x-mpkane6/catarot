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
  let s = String(value || "");
  // (1) Cú pháp đang gõ DỞ ở cuối (mở mà chưa đóng) → bỏ phần đuôi đó.
  s = s
    .replace(/\]\([^)]*$/, "") // ](url… link chưa đóng ngoặc
    .replace(/!?\[[^\]]*$/, "") // [nhãn… hoặc ![alt… chưa có ]
    .replace(/(^|\n)#{1,6}[ \t]*$/, "$1") // # tiêu đề ở cuối chưa có chữ
    .replace(/\s+$/, ""); // bỏ khoảng trắng cuối TRƯỚC khi cân bằng
  // Bản chỉ để ĐẾM nhấn mạnh: loại marker bullet đầu dòng (* - +) để không đếm nhầm '*'.
  const forCount = s.replace(/(^|\n)[ \t]{0,3}[*+-][ \t]+/g, "$1");
  // (2) Cân bằng dấu đóng còn thiếu (KHÔNG cắt nhầm dấu đóng của cụm đã hoàn chỉnh).
  if (((forCount.match(/`/g) || []).length) % 2 === 1) s += "`"; // `code`
  if (((forCount.match(/\*\*/g) || []).length) % 2 === 1) s += "**"; // **đậm**
  if (((forCount.replace(/\*\*/g, "").match(/\*/g) || []).length) % 2 === 1) s += "*"; // *nghiêng*
  return s;
}

// Đưa vị trí lộ chữ tới ranh giới TỪ kế tiếp (khoảng trắng/dấu câu) để không hiện cụt giữa
// một âm tiết tiếng Việt → karaoke đỡ giật, cleanupPartialMarkdown bớt phải cắt cụt.
function nextWordBoundary(text, index) {
  const s = String(text || "");
  if (index <= 0) return 0;
  if (index >= s.length) return s.length;
  const boundary = /[\s,.;:!?…—()"'‘’“”]/;
  let i = index;
  while (i < s.length && !boundary.test(s[i])) i += 1; // tới hết từ hiện tại
  while (i < s.length && boundary.test(s[i])) i += 1; // nuốt khoảng trắng/dấu câu liền sau
  return i;
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
  // Số ký tự (văn bản gốc) mà audio thực sự đọc tới — mẫu số ánh xạ tiến độ giọng→chữ.
  const spokenEndRef = useRef(null);
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
        const { audioBlob, spokenEnd } = await synthesizeSpeech(safeText);
        if (isCancelled) return;
        // Audio chỉ đọc tới spokenEnd ký tự của văn bản gốc (đã strip markdown + cắt nếu dài);
        // ánh xạ tiến độ giọng nói lên đúng đoạn này. Thiếu header → fallback toàn bộ (như cũ).
        spokenEndRef.current =
          Number.isFinite(spokenEnd) && spokenEnd > 0
            ? Math.min(spokenEnd, safeText.length)
            : safeText.length;

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
          // Chỉ lộ chữ khi đã có metadata (duration hợp lệ) VÀ audio thật sự chạy
          // (currentTime>0) — tránh "đứng hình" ở 0 lúc đang nạp + đỡ render thừa mỗi frame.
          if (!Number.isFinite(dur) || dur <= 0 || audio.currentTime <= 0) {
            if (!audio.ended) rafRef.current = requestAnimationFrame(tick);
            return;
          }
          const progress = Math.min(1, audio.currentTime / dur);
          // Mẫu số = đoạn audio thực đọc (spokenEnd), KHÔNG phải toàn bộ độ dài markdown.
          const end = spokenEndRef.current ?? safeText.length;
          const raw = Math.round(end * progress);
          const count = Math.min(safeText.length, nextWordBoundary(safeText, raw));
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
