import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  type?: "text" | "email";
  icon?: ReactNode;
  /** Field-level validation message, shown below and announced to AT. */
  error?: string;
}

export function Input({
  label,
  name,
  type = "text",
  icon,
  error,
  className,
  ...props
}: InputProps) {
  const errorId = useId();

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-gray-900">
        {label}
      </label>

      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        <input
          {...props}
          id={name}
          name={name}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 w-full rounded-lg border bg-white pr-4 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
            icon ? "pl-11" : "pl-4",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-500/15"
              : "focus:border-brand-500 focus:ring-brand-500/15 border-gray-200",
            className,
          )}
        />
      </div>

      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
