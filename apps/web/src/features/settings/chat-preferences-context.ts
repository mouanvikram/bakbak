import { createContext, useContext } from "react";
import type { ChatPreferencesType } from "@bakbak/contracts";

export interface ChatPreferencesContextValue {
  preferences: ChatPreferencesType;
  setPreferences: (next: Partial<ChatPreferencesType>) => void;
}

export const ChatPreferencesContext =
  createContext<ChatPreferencesContextValue | null>(null);

export function useChatPreferences(): ChatPreferencesContextValue {
  const ctx = useContext(ChatPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useChatPreferences must be used within a ChatPreferencesProvider",
    );
  }
  return ctx;
}
