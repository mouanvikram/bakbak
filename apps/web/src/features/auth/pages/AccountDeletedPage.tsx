import { useState } from "react";
import { Link, useLocation } from "react-router";
import { CheckCircle2, Mail, TimerReset, UserX } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Branding } from "@/components/ui/Branding";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { recoverAccount } from "@/features/auth/api";

/** Carried over from the login page: the soft-deleted account, its password
 * having just been validated. */
type DeletedAccountState = {
  id: string;
  identifier: string;
  deletedAt: string;
  remainingMs: number;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "no time left — the recovery window has lapsed";
  const totalHours = Math.floor(ms / 3_600_000);
  if (totalHours <= 0) return "less than an hour";
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayText = days === 1 ? "1 day" : `${days} days`;
  const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
  return days > 0 ? `${dayText}${hours > 0 ? ` and ${hourText}` : ""}` : hourText;
}

export function AccountDeletedPage() {
  const location = useLocation();
  const state = (location.state ?? null) as DeletedAccountState | null;

  const [email, setEmail] = useState(
    state && /@/.test(state.identifier) ? state.identifier : "",
  );
  const [status, setStatus] = useState<
    "idle" | "loading" | "sent" | "error"
  >("idle");
  const [error, setError] = useState("");

  async function handleSendRecovery() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    setStatus("loading");
    setError("");
    try {
      await recoverAccount({ email: normalizedEmail });
      setStatus("sent");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send the recovery email",
      );
      setStatus("error");
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-5 text-center">
        <Branding />
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
          <UserX size={44} strokeWidth={1.8} className="text-red-500" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">
            Account deleted
          </h2>
          <p className="text-sm leading-6 text-gray-500">
            Your account has been scheduled for deletion, and you've been
            signed out. The link we email you can still restore it.
          </p>
        </div>

        {state && (
          <div
            className={`w-full rounded-lg px-4 py-3 text-sm ${
              state.remainingMs > 0
                ? "bg-amber-50 text-amber-800"
                : "bg-gray-50 text-gray-500"
            }`}
          >
            {state.remainingMs > 0 ? (
              <>
                <span className="font-semibold">Recovery window:</span> about{" "}
                {formatRemaining(state.remainingMs)} remain before this account
                is permanently deleted.
              </>
            ) : (
              <>This account can no longer be recovered — its window has lapsed.</>
            )}
          </div>
        )}

        <div className="flex w-full flex-col gap-4">
          <div className="w-full text-left">
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              icon={<Mail size={18} />}
              value={email}
              disabled={status === "loading" || status === "sent"}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {status === "sent" ? (
            <div className="flex w-full flex-col gap-4">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 size={22} />
                <span>
                  If the account is still within its recovery window, a link is
                  on its way to that inbox. The link restores the account and
                  its data.
                </span>
              </div>
              <Link
                to="/login"
                className="flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition hover:opacity-95"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <Button
                value="Send recovery email"
                loading={status === "loading"}
                loadingText="Sending…"
                onClick={handleSendRecovery}
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <Link
                to="/recover-account"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <TimerReset size={18} />
                Have the link? Recover from here
              </Link>
              <Link
                to="/login"
                className="text-center text-sm text-gray-400 hover:text-gray-600"
              >
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}