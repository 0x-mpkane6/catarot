import { create } from "zustand";

export const oracleDialogues = {
  welcome: "Ta đã chờ ngươi. Hãy kể điều khiến lòng ngươi chưa yên.",
  idle: "Hãy đặt câu hỏi, các lá bài sẽ đáp lại.",
  listening: "Ta đang lắng nghe từng rung động trong câu hỏi của ngươi...",
  thinking: "Các biểu tượng đang dần hiện ra trong màn sương...",
  drawing: "Hãy để ta rút những lá bài đang gọi tên ngươi...",
  revealing: "Đã đến lúc lật mở thông điệp.",
  speaking: "Đây là điều các lá bài muốn ngươi nhìn thấy.",
  celebrating: "Ngọn lửa liên tục của ngươi vẫn đang cháy sáng.",
  warning: "Màn sương đang che khuất tín hiệu. Hãy thử lại một lần nữa.",
  sleeping: "Lời tiên tri này sẽ ngủ yên cho đến ngày được đánh thức.",
};

const intensityByState = {
  idle: "calm",
  welcome: "medium",
  listening: "medium",
  thinking: "high",
  drawing: "high",
  revealing: "high",
  speaking: "medium",
  celebrating: "high",
  warning: "medium",
  sleeping: "calm",
};

export const useOracleStore = create((set) => ({
  state: "welcome",
  dialogue: oracleDialogues.welcome,
  intensity: "medium",
  setOracleState: (state, dialogue) => {
    set({
      state,
      dialogue: dialogue || oracleDialogues[state] || oracleDialogues.idle,
      intensity: intensityByState[state] || "calm",
    });
  },
  speak: (dialogue) => set({ state: "speaking", dialogue, intensity: "medium" }),
}));
