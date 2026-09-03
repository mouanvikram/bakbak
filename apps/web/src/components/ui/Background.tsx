import { useTheme } from "@/features/settings/theme-context";

export function Background({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <div className="relative min-h-dvh w-full">
      {/* Auth-flow backdrop: the same wallpaper the conversation view uses,
          swapped with the theme. Kept as a `-z-10` fixed layer with no opaque
          background on the wrapper, or the wrapper would paint over it. */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage: `url('${
            dark
              ? "/images/backgrounds/chat_bg_dark.png"
              : "/images/backgrounds/chat_bg_light.png"
          }')`,
          backgroundColor: dark ? "#10151b" : "#ece5dd",
        }}
      />

      {children}
    </div>
  );
}
