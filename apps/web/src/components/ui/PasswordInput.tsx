import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  placeholder?: string;
  /** Field-level validation message, shown below and announced to AT. */
  error?: string;
}

export function PasswordInput({
  label,
  name,
  placeholder,
  error,
  className,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const errorId = useId();

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-gray-900">
        {label}
      </label>

      <div className="relative">
        <LockKeyhole
          size={20}
          strokeWidth={1.8}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
        />

        <input
          placeholder={placeholder}
          {...props}
          id={name}
          name={name}
          type={showPassword ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 w-full rounded-lg border bg-white pr-11 pl-11 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-500/15"
              : "border-gray-200 focus:border-brand-500 focus:ring-brand-500/15",
            className,
          )}
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          disabled={props.disabled}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 flex size-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
        >
          {showPassword ? (
            <EyeOff size={18} strokeWidth={1.8} />
          ) : (
            <Eye size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>

      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
