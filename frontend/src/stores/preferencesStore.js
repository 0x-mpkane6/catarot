import { create } from "zustand";

const PREF_KEY = "oracle_chamber_preferences";

function loadPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem(PREF_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

const initialPrefs = loadPrefs();

export const usePreferencesStore = create((set, get) => ({
  reduceMotion: Boolean(initialPrefs.reduceMotion),
  soundEnabled: Boolean(initialPrefs.soundEnabled),
  setReduceMotion: (reduceMotion) => {
    const next = { ...get(), reduceMotion: Boolean(reduceMotion) };
    savePrefs({ reduceMotion: next.reduceMotion, soundEnabled: next.soundEnabled });
    set({ reduceMotion: next.reduceMotion });
  },
  toggleReduceMotion: () => {
    const nextValue = !get().reduceMotion;
    const next = { reduceMotion: nextValue, soundEnabled: get().soundEnabled };
    savePrefs(next);
    set({ reduceMotion: nextValue });
  },
  toggleSound: () => {
    const nextValue = !get().soundEnabled;
    const next = { reduceMotion: get().reduceMotion, soundEnabled: nextValue };
    savePrefs(next);
    set({ soundEnabled: nextValue });
  },
}));
