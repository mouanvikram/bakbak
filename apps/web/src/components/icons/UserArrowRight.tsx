import type { LucideProps } from "lucide-react";

export function UserArrowRight({ size = 24, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="M2 21a8 8 0 0 1 12.664-6.5" />
      <circle cx="10" cy="8" r="5" />

      <path d="M22 19h-6" />
      <path d="m19 16 3 3-3 3" />
    </svg>
  );
}
