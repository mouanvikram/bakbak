import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string | null;
  alt?: string;
  className?: string;
  /** Show a presence dot when `true` (green); omitted/false renders nothing. */
  online?: boolean;
}

export function Avatar({ name, src, alt, className, online }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative size-10 shrink-0 text-sm font-medium",
        className,
      )}
    >
      <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-violet-100 text-violet-600">
        {src ? (
          <img src={src} alt={alt ?? name} className="size-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
      {online && (
        <span
          className="absolute right-0 bottom-0 block size-1/4 min-h-2 min-w-2 rounded-full border-2 border-white bg-green-500 dark:border-[#10151b]"
          aria-label="Online"
        />
      )}
    </div>
  );
}
