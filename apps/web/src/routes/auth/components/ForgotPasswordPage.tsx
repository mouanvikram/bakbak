import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, LoaderCircle, LockKeyhole, Mail, XCircle } from "lucide-react";
import { Background } from "@/components/ui/Background";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Branding } from "@/components/ui/Branding";
import { forgotPassword } from "@/api/auth.api";

type Status = "idle" | "loading" | "success" | "error";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;
    setStatus("loading");
    try {
      await forgotPassword({ email: normalizedEmail });
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request password reset");
      setStatus("error");
    }
  }

  return (
    <Background>
      <div className="flex min-h-screen w-full items-start justify-center px-4 pt-20">
        <div className="w-full max-w-md rounded-4xl border border-gray-100 bg-white p-10 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col items-center gap-6 text-center">
            <Branding />
            {status === "idle" && (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#4C18EF]/10">
                  <LockKeyhole size={42} strokeWidth={1.8} className="text-[#4C18EF]" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-gray-900">Forgot your password?</h2>
                  <p className="text-sm leading-6 text-gray-500">Enter the email address associated with your account and we'll send you a link to reset your password.</p>
                </div>
                <div className="w-full text-left">
                  <Input label="Email" name="email" type="email" placeholder="you@example.com" icon={<Mail size={18} />} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button value="Send Reset Link" onClick={handleSubmit} />
                <p className="text-sm text-gray-500">
                  Remember your password?{" "}
                  <Link to="/login" className="font-semibold text-[#4C18EF] hover:underline">Log in</Link>
                </p>
              </>
            )}
            {status === "loading" && (
              <>
                <LoaderCircle size={56} strokeWidth={1.8} className="animate-spin text-[#4C18EF]" />
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-gray-900">Sending reset link</h2>
                  <p className="text-sm leading-6 text-gray-500">Please wait while we send the password reset link.</p>
                </div>
              </>
            )}
            {status === "success" && (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle2 size={44} strokeWidth={1.8} className="text-green-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-gray-900">Check your inbox</h2>
                  <p className="text-sm leading-6 text-gray-500">If an account exists for this email address, we've sent you a password reset link.</p>
                </div>
                <div className="w-full rounded-xl bg-gray-50 px-4 py-3 text-left text-sm text-gray-500">Check your spam or junk folder if you don't see the email.</div>
                <p className="text-sm text-gray-400">
                  Didn't receive it?{" "}
                  <button type="button" onClick={() => setStatus("idle")} className="cursor-pointer font-semibold text-[#4C18EF] hover:underline">Try again</button>
                </p>
                <Link to="/login" className="flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition hover:opacity-95 active:translate-y-px">Back to Login</Link>
              </>
            )}
            {status === "error" && (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
                  <XCircle size={44} strokeWidth={1.8} className="text-red-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-gray-900">Something went wrong</h2>
                  <p className="text-sm leading-6 text-gray-500">{error || "We couldn't process your request right now. Please try again."}</p>
                </div>
                <div className="flex w-full gap-3">
                  <button type="button" onClick={() => setStatus("idle")} className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-gray-200 font-medium text-gray-700 transition hover:bg-gray-50">Try Again</button>
                  <Link to="/login" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] font-bold text-white transition hover:opacity-95">Login</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Background>
  );
}
