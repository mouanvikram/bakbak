import { Outlet } from "react-router";
import PrimaryNav from "./PrimaryNav";
import { SectionSidebar } from "./SectionSidebar";

function AppLayout() {
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
          <aside className="hidden h-full w-80 shrink-0 border-r border-gray-200 bg-white lg:flex">
            <SectionSidebar />
          </aside>

          {/* Page content */}
          <main className="min-w-0 flex-1 overflow-hidden bg-white pb-16 lg:pb-0">
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

export default AppLayout;
