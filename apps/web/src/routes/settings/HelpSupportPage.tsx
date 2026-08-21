export function HelpSupportPage() {
  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Help & Support</h1>
        <p className="text-sm text-gray-500">
          Get help, browse FAQs, or contact our support team
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <a
          href="#"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="font-semibold text-gray-900">Help Center</p>
            <p className="text-sm text-gray-500">
              Browse articles and tutorials
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </a>

        <a
          href="#"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="font-semibold text-gray-900">Contact Support</p>
            <p className="text-sm text-gray-500">
              Get in touch with our team
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </a>

        <a
          href="#"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="font-semibold text-gray-900">Report a Bug</p>
            <p className="text-sm text-gray-500">
              Let us know if something is broken
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </a>

        <a
          href="#"
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition hover:border-gray-300"
        >
          <div>
            <p className="font-semibold text-gray-900">Feature Request</p>
            <p className="text-sm text-gray-500">
              Suggest a new feature or improvement
            </p>
          </div>
          <span className="text-gray-400">→</span>
        </a>
      </div>
    </div>
  );
}
