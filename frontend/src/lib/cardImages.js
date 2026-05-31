// Resolve tarot card face images to their bundled production URLs.
//
// WHY: a raw "/src/assets/tarot/tarot_json/cards/xxx.jpg" string only works in
// the Vite dev server. After `vite build`, those files are hashed & relocated,
// so the literal string 404s and cards render blank in production (the bug that
// showed cards as empty rectangles with upside-down names). `import.meta.glob`
// makes Vite include every card image in the build and hands back the correct
// hashed URL — identical behavior in dev and production.

import tarotImages from "../assets/tarot/tarot_json/tarot-images.json";

// path -> resolved url, e.g. "../assets/.../cards/m00.jpg" -> "/assets/m00-ab12cd.jpg"
const urlByFile = {};

const modules = import.meta.glob(
  "../assets/tarot/tarot_json/cards/*.{jpg,jpeg,png,webp}",
  { eager: true, query: "?url", import: "default" }
);

for (const [path, url] of Object.entries(modules)) {
  const file = path.split("/").pop();
  urlByFile[file] = url;
}

// card display name -> image file name, e.g. "Death" -> "m13.jpg"
const fileByName = {};
for (const card of tarotImages.cards || []) {
  fileByName[card.name] = card.img;
}

/** URL for a card image file name (e.g. "m00.jpg"). Empty string if unknown. */
export function getCardImageByFile(imgFile) {
  return (imgFile && urlByFile[imgFile]) || "";
}

/** URL for a card by its display name (e.g. "The Fool", "Death"). Empty if unknown. */
export function getCardImageByName(cardName) {
  if (!cardName) return "";
  return getCardImageByFile(fileByName[cardName]);
}
