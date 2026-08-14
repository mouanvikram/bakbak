import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = {
  label: string;
  name: string;
  placeholder?: string;
};

export function PasswordInput({
  label,
  name,
  placeholder,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={name} className="text-md  font-semibold text-gray-900">
        {label}
      </label>

      <div className="relative">
        <LockKeyhole
          size={20}
          strokeWidth={1.8}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          id={name}
          name={name}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          className="
            h-12
            w-full
            rounded-lg
            border border-gray-200
            bg-white
            pl-11
            pr-11
            text-sm
            text-gray-800
            outline-none
            placeholder:text-gray-400
            transition
            focus:border-[#805FF8]
            focus:ring-2
            focus:ring-[#805FF8]/10
          "
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="
            absolute
            right-3
            top-1/2
            -translate-y-1/2
            text-gray-400
            transition
            hover:text-gray-600
          "
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
