import { Phone } from "lucide-react";

/**
 * Calls are not implemented yet (no WebRTC signalling, no call history model).
 * This is an intentional placeholder — see the roadmap in the README.
 */
export function CallsSidebar() {
  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="px-5 py-3">
        <h2 className="text-lg font-bold text-slate-900">Calls</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-slate-100">
          <Phone className="size-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">Calls are coming soon</p>
        <p className="text-xs text-slate-500">
          Voice and video calling isn&apos;t available yet.
        </p>
      </div>
    </aside>
  );
}
