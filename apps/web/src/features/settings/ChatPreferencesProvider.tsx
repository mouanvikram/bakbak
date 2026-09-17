import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { ChatPreferencesType } from "@bakbak/contracts";
import { useAuth } from "@/features/auth/auth-context";
import { getSettings, updateChatPreferences } from "@/features/settings/api";
import { setSoundsEnabled } from "@/lib/sounds";
import { reportError } from "@/lib/report";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { ChatPreferencesContext } from "./chat-preferences-context";

const DEFAULTS: ChatPreferencesType = {
  enterToSend: true,
  mediaPreview: true,
};

// Chat preferences, mirroring ThemeProvider: localStorage for an instant value,
// reconciled with the API once signed in.
export function ChatPreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [preferences, setState] = useState<ChatPreferencesType>(() =>
    readJson(STORAGE_KEYS.chatPreferences, DEFAULTS),
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getSettings()
      .then((res) => {
        if (cancelled) return;
        setState(res.chat);
        writeJson(STORAGE_KEYS.chatPreferences, res.chat);
        // Same response carries the Sounds switch; sync it while we're here.
        setSoundsEnabled(res.notifications.sounds);
      })
      .catch((err: unknown) => reportError("settings:load", err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const setPreferences = useCallback(
    (next: Partial<ChatPreferencesType>) => {
      setState((prev) => {
        const merged = { ...prev, ...next };
        writeJson(STORAGE_KEYS.chatPreferences, merged);
        if (isAuthenticated) {
          void updateChatPreferences(merged).catch((err: unknown) =>
            reportError("settings:chat:save", err),
          );
        }
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
