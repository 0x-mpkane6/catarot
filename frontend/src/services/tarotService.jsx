export const getTarotReading = async ({
  question,
  images = [],
  audio = null,
}) => {
  let url = "http://127.0.0.1:8000/api/ask";
  let options = {};

  // 🔥 normalize
  const safeQuestion = question || "";

  // =========================
  // 🔥 CASE 1: AUDIO (priority cao nhất)
  // =========================
  if (audio) {
    url = "http://127.0.0.1:8000/api/ask_with_media";

    const formData = new FormData();
    formData.append("question", safeQuestion);
    formData.append("user_id", "0"); // 🔥 phải string
    formData.append("spread_type", "three");
    formData.append("random_draw", "true"); // 🔥 phải string

    formData.append("audio", audio);

    options = {
      method: "POST",
      body: formData,
    };
  }

  // =========================
  // 🔥 CASE 2: IMAGE
  // =========================
  else if (images && images.length > 0) {
    url = "http://127.0.0.1:8000/api/ask_with_image";

    const formData = new FormData();
    formData.append("question", safeQuestion);
    formData.append("user_id", "0");
    formData.append("spread_type", "three");
    formData.append("random_draw", "true");

    images.forEach((img) => {
      // 🔥 QUAN TRỌNG: thử 1 trong 2
      formData.append("image", img);
      // nếu backend không nhận → đổi thành:
      // formData.append("files", img);
    });

    options = {
      method: "POST",
      body: formData,
    };
  }

  // =========================
  // 🔥 CASE 3: TEXT ONLY
  // =========================
  else {
    options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: safeQuestion,
        user_id: 0,
        image_paths: [],
        spread_type: "three",
        random_draw: true,
      }),
    };
  }

  // =========================
  // 🔥 DEBUG (rất nên giữ lúc dev)
  // =========================
  console.log("API URL:", url);

  const res = await fetch(url, options);

  if (!res.ok) {
    const errText = await res.text();
    console.error("API ERROR:", errText);
    throw new Error("API error");
  }

  return await res.json();
};