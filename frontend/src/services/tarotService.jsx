export const getTarotReading = async ({ question, cardIndexes }) => {
  const res = await fetch("http://127.0.0.1:8000/api/tarot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      spread_type: "three",
      image_paths: [], // 🔥 nếu m không dùng ảnh
      random_draw: true, // 🔥 dùng random draw
    }),
  });

  if (!res.ok) throw new Error("API error");

  return await res.json();
};