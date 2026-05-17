import api from "./api";

const ENDPOINTS = {
  ask: "/api/ask",
  askWithImage: "/api/ask_with_image",
  askWithMedia: "/api/ask_with_media",
};

const DEFAULT_READING_OPTIONS = {
  userId: 0,
  spreadType: "three",
  randomDraw: true,
  ratingReminderDays: 7,
};

const isUploadFile = (value) =>
  (typeof File !== "undefined" && value instanceof File) ||
  (typeof Blob !== "undefined" && value instanceof Blob);

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (isUploadFile(value)) return [value];
  return Array.from(value);
};

const postJson = async (endpoint, payload) => {
  const response = await api.post(endpoint, payload);
  return response.data;
};

const postForm = async (endpoint, formData) => {
  const response = await api.post(endpoint, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

const appendCommonFormFields = (
  formData,
  {
    question,
    userId,
    spreadType,
    randomDraw,
    ratingReminderDays,
  }
) => {
  formData.append("question", question);
  formData.append("user_id", String(userId));
  formData.append("spread_type", spreadType);
  formData.append("rating_reminder_days", String(ratingReminderDays));

  if (typeof randomDraw !== "undefined") {
    formData.append("random_draw", String(Boolean(randomDraw)));
  }
};

const normalizeReadingInput = ({
  question = "",
  userId,
  user_id,
  spreadType,
  spread_type,
  randomDraw,
  random_draw,
  ratingReminderDays,
  rating_reminder_days,
  images = [],
  image,
  imagePaths = [],
  image_paths = [],
  audio = null,
  audioPath = null,
  audio_path = null,
} = {}) => {
  const normalizedImages = [...toArray(images), ...toArray(image)].filter(
    isUploadFile
  );

  const normalizedImagePaths = [
    ...toArray(imagePaths),
    ...toArray(image_paths),
  ].filter(Boolean);

  return {
    question: String(question || "").trim(),
    userId: userId ?? user_id ?? DEFAULT_READING_OPTIONS.userId,
    spreadType:
      spreadType ?? spread_type ?? DEFAULT_READING_OPTIONS.spreadType,
    randomDraw:
      randomDraw ?? random_draw ?? DEFAULT_READING_OPTIONS.randomDraw,
    ratingReminderDays:
      ratingReminderDays ??
      rating_reminder_days ??
      DEFAULT_READING_OPTIONS.ratingReminderDays,
    images: normalizedImages,
    imagePaths: normalizedImagePaths,
    audio: isUploadFile(audio) ? audio : null,
    audioPath: audioPath ?? audio_path ?? null,
  };
};

export const askTarot = async (input = {}) => {
  const {
    question,
    userId,
    spreadType,
    randomDraw,
    ratingReminderDays,
    imagePaths,
    audioPath,
  } = normalizeReadingInput(input);

  return postJson(ENDPOINTS.ask, {
    question,
    user_id: userId,
    audio_path: audioPath,
    image_paths: imagePaths,
    spread_type: spreadType,
    random_draw: Boolean(randomDraw),
    rating_reminder_days: ratingReminderDays,
  });
};

export const askTarotWithImages = async (input = {}) => {
  const {
    question,
    userId,
    spreadType,
    ratingReminderDays,
    images,
  } = normalizeReadingInput(input);

  if (!images.length) {
    throw new Error("askTarotWithImages requires at least one image file.");
  }

  const formData = new FormData();
  appendCommonFormFields(formData, {
    question,
    userId,
    spreadType,
    ratingReminderDays,
  });

  images.slice(0, 3).forEach((file) => {
    formData.append("image", file);
  });

  return postForm(ENDPOINTS.askWithImage, formData);
};

export const askTarotWithMedia = async (input = {}) => {
  const {
    question,
    userId,
    spreadType,
    randomDraw,
    ratingReminderDays,
    images,
    audio,
  } = normalizeReadingInput(input);

  const formData = new FormData();
  appendCommonFormFields(formData, {
    question,
    userId,
    spreadType,
    randomDraw,
    ratingReminderDays,
  });

  images.slice(0, 3).forEach((file) => {
    formData.append("image", file);
  });

  if (audio) {
    formData.append("audio", audio);
  }

  return postForm(ENDPOINTS.askWithMedia, formData);
};

export const getTarotReading = async (input = {}) => {
  const normalizedInput = normalizeReadingInput(input);
  const hasUploadedImages = normalizedInput.images.length > 0;
  const hasUploadedAudio = Boolean(normalizedInput.audio);

  if (hasUploadedAudio) {
    return askTarotWithMedia(normalizedInput);
  }

  if (hasUploadedImages) {
    return askTarotWithImages(normalizedInput);
  }

  return askTarot(normalizedInput);
};

export const askTarotQuestion = getTarotReading;
