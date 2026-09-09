import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export function MobilePage({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex shrink-0 items-center gap-1 border-b border-gray-100 bg-white px-2 py-2 lg:hidden">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="-ml-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
        >
          <ArrowLeft className="size-5" />
        </button>
        {title && (
          <h1 className="truncate text-sm font-semibold text-gray-900">
            {title}
          </h1>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
