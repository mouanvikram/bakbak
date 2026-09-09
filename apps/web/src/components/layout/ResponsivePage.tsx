export function ResponsivePage({
  mobile,
  desktop,
}: {
  mobile: React.ReactNode;
  desktop: React.ReactNode;
}) {
  return (
    <>
      <div className="h-full w-full lg:hidden">{mobile}</div>
      <div className="hidden h-full w-full lg:block">{desktop}</div>
    </>
  );
}
