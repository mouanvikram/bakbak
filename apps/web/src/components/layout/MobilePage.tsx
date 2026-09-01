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
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2.5 bg-white lg:hidden">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="flex cursor-pointer items-center justify-center rounded-full p-1 text-gray-600 transition hover:bg-gray-100"
        >
          <ArrowLeft className="size-5" />
        </button>
        {title && (
          <span className="truncate text-sm font-semibold text-gray-900">
            {title}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}