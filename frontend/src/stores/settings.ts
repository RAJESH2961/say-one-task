import { create } from "zustand";
import { settingsApi } from "@/services";
import type { SettingsUpdate, ThemePreference, UserSettings } from "@/types/api";

const THEME_KEY = "focusflow-theme";

export function applyTheme(theme: ThemePreference) {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_KEY, theme); // UI preference cache to avoid a flash on load
  } catch {
    /* storage unavailable */
  }
}

export function cachedTheme(): ThemePreference {
  try {
    return (localStorage.getItem(THEME_KEY) as ThemePreference | null) ?? "system";
  } catch {
    return "system";
  }
}

interface SettingsState {
  settings: UserSettings | null;
  loading: boolean;
  load: () => Promise<UserSettings>;
  update: (patch: SettingsUpdate) => Promise<UserSettings>;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: null,
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const settings = await settingsApi.get();
      set({ settings });
      applyTheme(settings.theme);
      // Keep the server's timezone in sync with the browser so analytics bucket days correctly.
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz && settings.timezone === "UTC" && browserTz !== "UTC") {
        const updated = await settingsApi.update({ timezone: browserTz }).catch(() => settings);
        set({ settings: updated });
        return updated;
      }
      return settings;
    } finally {
      set({ loading: false });
    }
  },
  update: async (patch) => {
    const settings = await settingsApi.update(patch);
    set({ settings });
    applyTheme(settings.theme);
    return settings;
  },
  reset: () => set({ settings: null }),
}));
