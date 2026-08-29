export function LoadingState({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}