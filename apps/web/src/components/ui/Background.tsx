export function Background({ children }: { children: React.ReactElement }) {
  return (
    <div
      className="w-full min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('images/backgrounds/chat_bg_light.png')" }}
    >
      {children}
    </div>
  );
}
