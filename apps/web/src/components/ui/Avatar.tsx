import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string | null;
  alt?: string;
  className?: string;
}

export function Avatar({ name, src, alt, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-sm font-medium text-violet-600",
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt ?? name} className="size-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}