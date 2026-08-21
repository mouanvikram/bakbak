export function AboutBakbakPage() {
  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">About BakBak</h1>
        <p className="text-sm text-gray-500">
          Version, terms, and privacy policy
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="font-semibold text-gray-900">Version</p>
          <p className="text-sm text-gray-500">1.0.0</p>
        </div>

        <a
          href="#"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="font-semibold text-gray-900">Terms of Service</p>
            <p className="text-sm text-gray-500">
              Read our terms and conditions
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </a>

        <a
          href="#"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="font-semibold text-gray-900">Privacy Policy</p>
            <p className="text-sm text-gray-500">
              Learn how we handle your data
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </a>

        <a
          href="#"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="font-semibold text-gray-900">Open Source Licenses</p>
            <p className="text-sm text-gray-500">
              Third-party libraries and licenses
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </a>
      </div>
    </div>
  );
}
