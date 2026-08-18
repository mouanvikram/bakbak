import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function Button({ value, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {value}
    </button>
  );
}
