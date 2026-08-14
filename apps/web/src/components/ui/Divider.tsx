export function Divider() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-gray-300" />
      <span className="text-sm text-gray-500">or</span>
      <div className="h-px flex-1 bg-gray-300" />
    </div>
  );
}