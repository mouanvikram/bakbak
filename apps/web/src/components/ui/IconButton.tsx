import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required, since the button has no visible text. */
  label: string;
  children: ReactNode;
  /** sm = 36px hit area, md = 40px. */
  size?: "sm" | "md";
}

/**
 * A circular, icon-only control with a comfortable hit area and the shared
 * hover/focus treatment. Replaces the hand-rolled
 * `rounded-full p-1.5 hover:bg-…` buttons that were scattered across the app.
 */
export function IconButton({
  label,
  children,
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      aria-label={label}
      {...props}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "size-9" : "size-10",
        className,
      )}
    >
      {children}
    </button>
  );
}
