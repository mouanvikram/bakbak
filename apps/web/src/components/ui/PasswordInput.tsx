import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  placeholder?: string;
}

export function PasswordInput({
  label,
  name,
  placeholder,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={name} className="text-md font-semibold text-gray-900">
        {label}
      </label>

      <div className="relative">
        <LockKeyhole
          size={20}
          strokeWidth={1.8}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
        />

        <input
          placeholder={placeholder}
          {...props}
          id={name}
          name={name}
          type={showPassword ? "text" : "password"}
          className="h-12 w-full rounded-lg border border-gray-200 bg-white pr-11 pl-11 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10"
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff size={20} strokeWidth={1.8} />
          ) : (
            <Eye size={20} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}
