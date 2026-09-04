import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms on screen; 0 keeps it until dismissed. */
  duration?: number;
  /** Makes the whole toast a button (e.g. "open this conversation"). */
  onAction?: () => void;
  /** Collapse repeats: a new toast with the same key replaces the old one. */
  dedupeKey?: string;
  icon?: ReactNode;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (opts: ToastOptions) => number;
  success: (title: string, opts?: Omit<ToastOptions, "title" | "variant">) => number;
  error: (title: string, opts?: Omit<ToastOptions, "title" | "variant">) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const MAX_VISIBLE = 4;
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const keyed = useRef(new Map<string, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const h = timers.current.get(id);
    if (h) clearTimeout(h);
    timers.current.delete(id);
    for (const [k, v] of keyed.current) if (v === id) keyed.current.delete(k);
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++seq;
      const duration = opts.duration ?? 5000;

      setToasts((prev) => {
        let next = prev;
        if (opts.dedupeKey) {
          const existing = keyed.current.get(opts.dedupeKey);
          if (existing != null) {
            next = next.filter((t) => t.id !== existing);
            const h = timers.current.get(existing);
            if (h) clearTimeout(h);
            timers.current.delete(existing);
          }
          keyed.current.set(opts.dedupeKey, id);
        }
        return [...next, { ...opts, id }].slice(-MAX_VISIBLE);
      });

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (title, opts) => toast({ ...opts, title, variant: "success" }),
      error: (title, opts) => toast({ ...opts, title, variant: "error" }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const ICON: Record<ToastVariant, ReactNode> = {
  default: null,
  success: <CheckCircle2 className="size-5 text-green-500" />,
  error: <TriangleAlert className="size-5 text-red-500" />,
  info: <Info className="size-5 text-brand-500" />,
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{ zIndex: "var(--z-toast)" }}
      className="pointer-events-none fixed inset-x-0 bottom-20 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
    >
      {toasts.map((t) => {
        const icon = t.icon ?? ICON[t.variant ?? "default"];
        const body = (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {t.title}
              </p>
              {t.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                  {t.description}
                </p>
              )}
            </div>
          </>
        );

        return (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-gray-200 bg-white p-3 shadow-lg",
              "motion-safe:animate-[toast-in_200ms_ease-out]",
            )}
          >
            {t.onAction ? (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  onDismiss(t.id);
                }}
                className="flex min-w-0 flex-1 items-start gap-2.5 rounded text-left"
              >
                {body}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-start gap-2.5">{body}</div>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => onDismiss(t.id)}
              className="-m-1 shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
