import type { ReactNode } from "react";

type InputProps = {
  label: string;
  name: string;
  type?: "text" | "email";
  placeholder?: string;
  icon?: ReactNode;
};

export function Input({
  label,
  name,
  type = "text",
  placeholder,
  icon,
}: InputProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor={name}
        className="text-sm font-medium text-gray-800"
      >
        {label}
      </label>

      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          className={`
            h-10
            w-full
            rounded-lg
            border border-gray-200
            bg-white
            pr-4
            text-sm
            text-gray-800
            outline-none
            placeholder:text-gray-400
            transition
            focus:border-[#805FF8]
            focus:ring-2
            focus:ring-[#805FF8]/10
            ${icon ? "pl-11" : "pl-4"}
          `}
        />
      </div>
    </div>
  );
}