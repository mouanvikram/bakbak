import { useIsDesktop } from "@/lib/use-media-query";

/**
 * Renders only the side that matches the viewport. Hiding one with CSS would
 * still mount it, and a mounted sidebar fetches and subscribes — which is how
 * the chat list ended up loading itself twice on `/chats`.
 */
export function ResponsivePage({
  mobile,
  desktop,
}: {
  mobile: React.ReactNode;
  desktop: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();
  return <div className="h-full w-full">{isDesktop ? desktop : mobile}</div>;
}
