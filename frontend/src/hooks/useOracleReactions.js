import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { oracleDialogues, useOracleStore } from "../stores/oracleStore";

const routeReactions = {
  "/": {
    state: "welcome",
    line: "Ta đã chờ ngươi. Hãy bước vào căn phòng.",
  },
  "/reading": {
    state: "idle",
    line: "Hãy đặt câu hỏi, các lá bài sẽ đáp lại.",
  },
  "/daily-card": {
    state: "drawing",
    line: "Lá bài hôm nay đã chọn ngươi.",
  },
  "/dream-journal": {
    state: "thinking",
    line: "Hãy kể giấc mơ - sương sẽ vẽ lại biểu tượng.",
  },
  "/duo": {
    state: "listening",
    line: "Hai nguồn năng lượng đã cùng bước vào căn phòng.",
  },
  "/community": {
    state: "speaking",
    line: "Một căn phòng kín nơi những kẻ tìm dấu hiệu cùng nhau giải bài.",
  },
  "/profile": {
    state: "celebrating",
    line: "Đây là chân dung linh hồn ngươi qua các lá bài.",
  },
  "/time-capsule": {
    state: "sleeping",
    line: "Lời tiên tri này sẽ ngủ yên cho đến ngày được đánh thức.",
  },
  "/login": {
    state: "welcome",
    line: "Ta cần biết tên ngươi trước khi mở cửa.",
  },
  "/register": {
    state: "welcome",
    line: "Hãy đặt một cái tên - ta sẽ ghi vào sổ tiên tri.",
  },
};

const visibilityLines = {
  away: "Ta sẽ chờ. Đừng để màn sương lạnh đi.",
  back: "Ngươi đã trở lại. Các lá bài vẫn còn ấm.",
};

/**
 * Gắn các phản ứng "sống" cho oracle: chuyển tab, ẩn/hiện cửa sổ.
 * Đặt 1 lần ở AppShell.
 */
export function useOracleReactions() {
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const location = useLocation();
  const lastVisibility = useRef(typeof document !== "undefined" ? document.visibilityState : "visible");

  // Phản ứng theo route (chuyển tab/menu)
  useEffect(() => {
    const reaction = routeReactions[location.pathname] || {
      state: "idle",
      line: oracleDialogues.idle,
    };
    setOracleState(reaction.state, reaction.line);
  }, [location.pathname, setOracleState]);

  // Phản ứng khi user rời tab / quay lại
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        lastVisibility.current = "hidden";
        setOracleState("sleeping", visibilityLines.away);
      } else if (lastVisibility.current === "hidden") {
        lastVisibility.current = "visible";
        setOracleState("welcome", visibilityLines.back);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [setOracleState]);
}

const typingLines = [
  "Ta đang lắng nghe từng rung động trong câu hỏi của ngươi...",
  "Hãy cứ viết. Ta nghe thấy cả khoảng lặng giữa các chữ.",
  "Mỗi câu chữ là một lá bài chưa lật.",
];

const idleAfterTypingLine = "Các biểu tượng đang dần hiện ra trong màn sương...";

/**
 * Hook gắn vào textarea/input câu hỏi:
 * - đang gõ → state "listening"
 * - dừng gõ 1.6s → state "thinking"
 * - rỗng → quay về "idle"
 */
export function useTypingOracle(text) {
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const idleTimerRef = useRef(null);
  const lastLineRef = useRef(0);

  useEffect(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (!text || !text.trim()) {
      setOracleState("idle");
      return undefined;
    }
    const line = typingLines[lastLineRef.current % typingLines.length];
    lastLineRef.current += 1;
    setOracleState("listening", line);

    idleTimerRef.current = window.setTimeout(() => {
      setOracleState("thinking", idleAfterTypingLine);
    }, 1600);

    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [text, setOracleState]);
}

const flipLines = [
  "Đã đến lúc lật mở thông điệp.",
  "Ánh sáng vừa chạm vào lá bài...",
  "Đây là điều ngươi cần nhìn thấy.",
];

/**
 * Gọi khi 1 lá bài vừa được lật.
 */
export function fireOracleFlip() {
  const setOracleState = useOracleStore.getState().setOracleState;
  const line = flipLines[Math.floor(Math.random() * flipLines.length)];
  setOracleState("revealing", line);
}
