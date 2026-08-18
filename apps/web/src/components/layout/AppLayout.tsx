import { Outlet } from "react-router";
import SideOptions from "./SideOptions";
import { SecondSidebar } from "./SecondSidebar";

function AppLayout() {
  return (
    <div className="bg-background h-screen w-full overflow-hidden">
      {/* Desktop / Tablet layout */}
      <div className="flex h-full">
        {/* Primary navigation */}
        <aside className="hidden h-full w-20 shrink-0 bg-gray-100 px-1 py-2 md:flex">
          <SideOptions />
        </aside>

        {/* Secondary navigation + content */}
        <div className="flex min-w-0 flex-1">
          {/* Current section navigation */}
          <aside className="hidden h-full w-80 flex-1 shrink-0 bg-gray-100 py-2 pr-1 lg:flex">
            <SecondSidebar />
          </aside>

          {/* Page content */}
          <main className="min-w-0 flex-3 overflow-hidden bg-gray-100 py-2 pr-2 lg:flex">
            <div className="flex h-full w-full flex-col overflow-y-auto rounded-lg bg-white shadow-md">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile primary navigation */}
      <aside className="bg-background fixed inset-x-0 bottom-0 z-50 flex h-16 border-t md:hidden">
        <SideOptions />
      </aside>
    </div>
  );
}

export default AppLayout;
