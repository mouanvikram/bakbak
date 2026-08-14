import { Logo } from "./Logo";

export function Branding() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-5">
        <Logo width={60} height={60} />

        <div className="flex items-center">
          <h1 className="text-4xl leading-none font-bold">BakBak</h1>
        </div>
      </div>

      <div className="text-gray-500">Chat more. Connect better.</div>
    </div>
  );
}
