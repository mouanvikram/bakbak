export function DevicesPage() {
  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Devices</h1>
        <p className="text-sm text-gray-500">
          Manage your connected devices and sessions
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Current Session</p>
              <p className="text-sm text-gray-500">This device — Active now</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Active
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                Chrome on Windows
              </p>
              <p className="text-sm text-gray-500">
                Last active 2 hours ago
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-red-600 hover:text-red-700"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                Safari on iPhone
              </p>
              <p className="text-sm text-gray-500">
                Last active 1 day ago
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-red-600 hover:text-red-700"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
