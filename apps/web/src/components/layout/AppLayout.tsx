import { Outlet } from "react-router";
import { PrimaryNav } from "./PrimaryNav";
import { SectionSidebar } from "./SectionSidebar";
import { useIsDesktop } from "@/lib/use-media-query";

export function AppLayout() {
  // Mounted only on desktop: below `lg` the section list is a route of its
  // own, and a CSS-hidden copy here would still fetch and subscribe.
  const isDesktop = useIsDesktop();

  return (
    <div className="h-screen w-full overflow-hidden bg-white">
      {/* Desktop / Tablet layout */}
      <div className="flex h-full">
        {/* Primary navigation */}
        <aside className="hidden h-full w-20 shrink-0 border-r border-gray-200 bg-white md:flex">
          <PrimaryNav />
        </aside>

        {/* Secondary navigation + content */}
        <div className="flex min-w-0 flex-1">
          {/* Current section navigation */}
          {isDesktop && (
            <aside className="flex h-full w-80 shrink-0 border-r border-gray-200 bg-white">
              <SectionSidebar />
            </aside>
          )}

          {/* Page content */}
          <main className="min-w-0 flex-1 overflow-hidden bg-white pb-16 md:pb-0">
            <div className="flex h-full w-full flex-col overflow-y-auto bg-white">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile primary navigation — flush with the page content above it */}
      <aside className="fixed inset-x-0 bottom-0 z-50 flex h-16 border-t border-gray-200 bg-white md:hidden">
        <PrimaryNav />
      </aside>
    </div>
  );
}
