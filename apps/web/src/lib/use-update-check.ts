import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { compareVersions, fetchServerVersion } from "./version";

/**
 * Tells a long-lived tab that a newer build has shipped.
 *
 * A deploy ships the web bundle and the API from one commit, so once the
 * server reports a version this bundle does not carry, whatever is on screen
 * is running old code — possibly against changed contracts. The toast is
 * persistent and offers a reload rather than forcing one, because a refresh
 * mid-conversation would throw away an unsent message.
 */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

export function useUpdateCheck(): void {
  const { toast } = useToast();
  // One prompt per tab. Without this, every interval tick re-raises it after
  // the user has deliberately dismissed it.
  const notified = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // A background tab can't act on the prompt, and polling it just burns
      // requests — the focus listener covers the user coming back.
      if (cancelled || notified.current || document.hidden) return;

      const status = compareVersions(await fetchServerVersion());
      if (cancelled || status.state !== "outdated") return;

      notified.current = true;
      toast({
        title: "A new version is available",
        description: `Version ${status.latest} has shipped. Refresh to update.`,
        variant: "info",
        duration: 0,
        dedupeKey: "app-update",
        onAction: () => window.location.reload(),
      });
    }

    void check();
    const interval = setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [toast]);
}

/** Mounts the check inside the provider tree; renders nothing itself. */
export function UpdateCheck(): null {
  useUpdateCheck();
  return null;
}
