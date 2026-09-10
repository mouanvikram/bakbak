import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Spinner } from "@/components/ui/Spinner";
import { requestAccountDeletionChallenge } from "@/features/users/api";

export function DeleteAccountDialog({
  username,
  onConfirm,
  onClose,
}: {
  username: string;
  onConfirm: (password: string, twoFactorCode?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // null = password not yet confirmed; otherwise whether a 2FA code is owed.
  const [twoFactorRequired, setTwoFactorRequired] = useState<boolean | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const phrase = `delete:${username}`;
  const phraseMatches = text.trim() === phrase;
  const canContinue = phraseMatches && password.length > 0 && !busy;
  const canDelete = !busy && (twoFactorRequired ? code.length === 6 : true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function handleContinue() {
    if (!canContinue) return;
    setBusy(true);
    setError("");
    try {
      const response = await requestAccountDeletionChallenge(password);
      setTwoFactorRequired(response.twoFactorRequired);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to confirm password",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!canDelete || twoFactorRequired === null) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(password, twoFactorRequired ? code : undefined);
      navigate("/account-deleted", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 motion-safe:animate-[fade-in_120ms_ease-out]"
      onClick={() => !busy && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl motion-safe:animate-[pop-in_150ms_var(--ease-emphasized)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-account-title"
          className="text-base font-semibold text-red-600"
        >
          Delete account
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This permanently removes your profile, messages, chats, friends and
          all related data. It cannot be undone. Confirm your password to
          proceed, then re-enter any emailed verification code.
        </p>

        <p className="mt-4 text-sm text-slate-600">
          Type{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 select-all">
            {phrase}
          </code>{" "}
          to confirm.
        </p>

        <input
          type="text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && canContinue && void handleContinue()
          }
          disabled={busy}
          spellCheck={false}
          autoCapitalize="none"
          placeholder={phrase}
          className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-4 font-mono text-sm text-gray-800 transition outline-none focus:border-red-400 focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && canContinue && void handleContinue()
          }
          disabled={busy || twoFactorRequired !== null}
          placeholder="Password"
          autoComplete="current-password"
          className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 transition outline-none focus:border-red-400 focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {twoFactorRequired === true && (
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) =>
              e.key === "Enter" && canDelete && void handleDelete()
            }
            disabled={busy}
            placeholder="6-digit code from your email"
            maxLength={6}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="one-time-code"
            className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-4 font-mono text-sm text-gray-800 transition outline-none focus:border-red-400 focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          />
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 rounded-lg border border-gray-200 bg-white px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          {twoFactorRequired === null ? (
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Spinner className="size-4" />}
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Spinner className="size-4" />}
              {busy ? "Deleting…" : "Delete account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}