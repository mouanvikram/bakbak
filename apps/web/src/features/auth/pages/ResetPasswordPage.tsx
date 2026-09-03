import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Branding } from "@/components/ui/Branding";
import { resetPassword } from "@/features/auth/api";

type Status = "form" | "loading" | "success" | "expired" | "error";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "form" : "error");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit() {
    setErrorMessage("");
    if (!password || !confirmPassword) {
      setErrorMessage("Please enter your new password.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (!token) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      await resetPassword(token, { newPassword: password });
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("expired") || message.includes("410")) {
        setStatus("expired");
      } else {
        setErrorMessage(message || "Failed to reset password.");
        setStatus("error");
      }
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-5 text-center">
        <Branding />
        {status === "form" && (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Reset your password
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                Create a new password for your BakBak account.
              </p>
            </div>
            <div className="flex w-full flex-col gap-4 text-left">
              <PasswordInput
                label="New Password"
                name="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordInput
                label="Confirm Password"
                name="confirmPassword"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {errorMessage && (
                <p className="text-sm text-red-500">{errorMessage}</p>
              )}
            </div>
            <div className="w-full">
              <Button value="Reset Password" onClick={handleSubmit} />
            </div>
          </>
        )}
        {status === "loading" && (
          <>
            <LoaderCircle
              size={56}
              strokeWidth={1.8}
              className="animate-spin text-[#4C18EF]"
            />
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Resetting your password
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                Please wait while we securely update your password.
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
                Password reset successfully
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                Your password has been changed successfully. You can now log in
                with your new password.
              </p>
            </div>
            <Link
              to="/login"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition hover:opacity-95 active:translate-y-px"
            >
              Go to Login
            </Link>
          </>
        )}
        {status === "expired" && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
              <XCircle size={44} strokeWidth={1.8} className="text-amber-500" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Reset link expired
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                This password reset link has expired. Request a new link to
                reset your password.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] font-bold text-white transition hover:opacity-95"
            >
              Request New Reset Link
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
                Unable to reset password
              </h2>
              <p className="text-sm leading-6 text-gray-500">
                {errorMessage ||
                  "The reset link may be invalid or something went wrong. Please request a new reset link."}
              </p>
            </div>
            <div className="flex w-full gap-3">
              <Link
                to="/forgot-password"
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Try Again
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
