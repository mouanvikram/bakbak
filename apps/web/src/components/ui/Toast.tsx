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
import { playSound } from "@/lib/sounds";
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
  /** Playing its exit animation; removed once that finishes. */
  leaving?: boolean;
}

interface ToastApi {
  toast: (opts: ToastOptions) => number;
  success: (
    title: string,
    opts?: Omit<ToastOptions, "title" | "variant">,
  ) => number;
  error: (
    title: string,
    opts?: Omit<ToastOptions, "title" | "variant">,
  ) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const MAX_VISIBLE = 4;
const EXIT_MS = 180;
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const keyed = useRef(new Map<string, number>());

  const clearTimer = useCallback((id: number) => {
    const h = timers.current.get(id);
    if (h) clearTimeout(h);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      for (const [k, v] of keyed.current) if (v === id) keyed.current.delete(k);
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      );
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, EXIT_MS),
      );
    },
    [clearTimer],
  );

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++seq;
      const duration = opts.duration ?? 5000;
      if (opts.variant === "error") playSound("alert");
      else if (opts.variant === "success") playSound("success");

      // Timer and dedupe bookkeeping stays out of the state updater: StrictMode
      // runs updaters twice, and a second pass would find this toast's own id
      // under the key and cancel its auto-dismiss.
      let replaced: number | undefined;
      if (opts.dedupeKey) {
        replaced = keyed.current.get(opts.dedupeKey);
        if (replaced != null) clearTimer(replaced);
        keyed.current.set(opts.dedupeKey, id);
      }

      setToasts((prev) => {
        const item: ToastItem = { ...opts, id };
        const idx =
          replaced == null ? -1 : prev.findIndex((t) => t.id === replaced);
        if (idx !== -1) {
          // Swap in place so a repeat doesn't jump around the stack.
          const next = [...prev];
          next[idx] = item;
          return next;
        }
        return [...prev, item].slice(-MAX_VISIBLE);
      });

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss, clearTimer],
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
  info: <Info className="text-brand-500 size-5" />,
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
                <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-500">
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
              "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-gray-200 bg-white py-3.5 pr-3 pl-4 shadow-lg",
              t.leaving
                ? "motion-safe:animate-[toast-out_180ms_ease-in_forwards]"
                : "motion-safe:animate-[toast-in_220ms_var(--ease-emphasized)]",
            )}
          >
            {t.onAction ? (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  onDismiss(t.id);
                }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded text-left"
              >
                {body}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {body}
              </div>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 self-start rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
