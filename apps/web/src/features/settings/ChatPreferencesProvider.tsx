import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { ChatPreferencesType } from "@bakbak/contracts";
import { useAuth } from "@/features/auth/auth-context";
import { getSettings, updateChatPreferences } from "@/features/settings/api";
import { ChatPreferencesContext } from "./chat-preferences-context";

const STORAGE_KEY = "bakbak.chatPreferences";
const DEFAULTS: ChatPreferencesType = {
  enterToSend: true,
  mediaPreview: true,
};

function readStored(): ChatPreferencesType {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ChatPreferencesType>;
    return {
      enterToSend:
        typeof parsed.enterToSend === "boolean" ? parsed.enterToSend : true,
      mediaPreview:
        typeof parsed.mediaPreview === "boolean" ? parsed.mediaPreview : true,
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(prefs: ChatPreferencesType) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

// Chat preferences, mirroring ThemeProvider: localStorage for an instant value,
// reconciled with the API once signed in.
export function ChatPreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [preferences, setState] = useState<ChatPreferencesType>(readStored);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getSettings()
      .then((res) => {
        if (cancelled) return;
        setState(res.chat);
        persist(res.chat);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const setPreferences = useCallback(
    (next: Partial<ChatPreferencesType>) => {
      setState((prev) => {
        const merged = { ...prev, ...next };
        persist(merged);
        if (isAuthenticated) void updateChatPreferences(merged).catch(() => {});
        return merged;
      });
    },
    [isAuthenticated],
  );

  return (
    <ChatPreferencesContext.Provider value={{ preferences, setPreferences }}>
      {children}
    </ChatPreferencesContext.Provider>
  );
}
