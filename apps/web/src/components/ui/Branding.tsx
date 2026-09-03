import { Logo } from "./Logo";

export function Branding() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-3">
        <Logo width={40} height={40} />
        <h1 className="text-3xl leading-none font-bold text-gray-900">
          BakBak
        </h1>
      </div>

      <p className="text-sm text-gray-500">Chat more. Connect better.</p>
    </div>
  );
}
