import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  type?: "text" | "email";
  icon?: ReactNode;
}

export function Input({
  label,
  name,
  type = "text",
  icon,
  ...props
}: InputProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={name} className="text-md font-semibold text-gray-900">
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
          className={`h-12 w-full rounded-lg border border-gray-200 bg-white pr-4 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10 disabled:cursor-not-allowed disabled:opacity-50 ${icon ? "pl-11" : "pl-4"} `}
        />
      </div>
    </div>
  );
}
