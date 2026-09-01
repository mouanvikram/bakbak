import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  loading?: boolean;
  loadingText?: string;
}

export function Button({ value, loading, loadingText, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {loading ? (loadingText ?? value) : value}
    </button>
  );
}