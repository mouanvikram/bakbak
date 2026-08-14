export function Logo({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <div>
      <img
        src="/images/branding/logo.svg"
        alt="Logo"
        width={width}
        height={height}
      />
    </div>
  );
}