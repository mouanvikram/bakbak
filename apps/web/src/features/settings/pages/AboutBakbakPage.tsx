const RESOURCES = [
  { label: "Terms of Service", description: "Read our terms and conditions" },
  { label: "Privacy Policy", description: "Learn how we handle your data" },
  {
    label: "Open Source Licenses",
    description: "Third-party libraries and licenses",
  },
];

export function AboutBakbakPage() {
  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">About BakBak</h1>
        <p className="text-sm text-gray-500">Version, terms, and privacy policy</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="font-semibold text-gray-900">Version</p>
          <p className="text-sm text-gray-500">1.0.0</p>
        </div>

        {RESOURCES.map((resource) => (
          <div
            key={resource.label}
            className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
          >
            <div>
              <p className="font-semibold text-gray-900">{resource.label}</p>
              <p className="text-sm text-gray-500">{resource.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
