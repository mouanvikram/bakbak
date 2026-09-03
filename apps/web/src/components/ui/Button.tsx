import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  /** Icon rendered before the label. */
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  variant?: Variant;
  size?: Size;
  /** Defaults to true so form submit buttons keep filling their column. */
  fullWidth?: boolean;
}

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-linear-to-br from-[#805FF8] to-[#4C18EF] text-white shadow-sm hover:brightness-[1.06]",
  secondary: "border border-gray-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
};

export function Button({
  value,
  icon,
  loading,
  loadingText,
  variant = "primary",
  size = "md",
  fullWidth = true,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        sizes[size],
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {loading ? (loadingText ?? value) : value}
    </button>
  );
}
