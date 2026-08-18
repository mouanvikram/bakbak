export function Background({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/images/backgrounds/chat_bg_colorful_adult.png')",
        }}
      />

      {children}
    </div>
  );
}
