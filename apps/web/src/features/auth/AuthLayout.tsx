import type { ReactNode } from "react";
import { Background } from "@/components/ui/Background";

/**
 * Shared shell for every auth screen: the wallpaper, a viewport-height flex box
 * that centres the card, and the card itself. The card — not the page — takes
 * the scrollbar if content ever outgrows the viewport, so the page never scrolls.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Background>
      <div className="flex min-h-dvh w-full items-center justify-center p-4">
        <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl sm:p-8">
          {children}
        </div>
      </div>
    </Background>
  );
}
