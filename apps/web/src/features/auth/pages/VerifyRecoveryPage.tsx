import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  CheckCircle2,
  LoaderCircle,
  MailWarning,
  XCircle,
} from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Branding } from "@/components/ui/Branding";
import { verifyRecovery } from "@/features/auth/api";

type RecoveryStatus = "verifying" | "success" | "expired" | "error";

export function VerifyRecoveryPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<RecoveryStatus>("verifying");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      return;
    }

    const recover = async () => {
      try {
        await verifyRecovery(token);
        setStatus("success");
      } catch {
        setStatus("expired");
      }
    };

    recover();
  }, [searchParams]);

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-5 text-center">
        <Branding />

        {status === "verifying" && (
          <>
            <LoaderCircle
              size={56}
              strokeWidth={1.8}
              className="animate-spin text-[#4C18EF]"
            />
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Recovering your account
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                Please wait while we restore your account.
              </p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2
                size={44}
                strokeWidth={1.8}
                className="text-green-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Account recovered
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                Your account has been restored. You can now log in to BakBak
                again.
              </p>
            </div>
            <Link
              to="/login"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition hover:opacity-95 active:translate-y-px"
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "expired" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
              <MailWarning
                size={44}
                strokeWidth={1.8}
                className="text-amber-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Recovery link invalid or expired
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                This recovery link is no longer valid, or your account is
                outside its 30-day window. Request a new link to continue.
              </p>
            </div>
            <Link
              to="/recover-account"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition hover:opacity-95 active:translate-y-px"
            >
              Request a New Link
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <XCircle size={44} strokeWidth={1.8} className="text-red-500" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Recovery failed
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                We couldn't restore your account. The link may be invalid or
                something went wrong.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <Link
                to="/recover-account"
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Request New Link
              </Link>
              <Link
                to="/login"
                className="flex h-11 flex-1 items-center justify-center rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] font-bold text-white transition hover:opacity-95"
              >
                Login
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}