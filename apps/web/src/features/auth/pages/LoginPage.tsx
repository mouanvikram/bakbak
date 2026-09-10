import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { OtpInput } from "@/components/ui/OtpInput";
import { Branding } from "@/components/ui/Branding";
import { useAuth } from "@/features/auth/auth-context";
import { resendTwoFactorLogin } from "@/features/auth/api";

export function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, verifyTwoFactorLogin } = useAuth();
  const navigate = useNavigate();

  // Set once the password step passes and the account has 2FA on.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendNote, setResendNote] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      const result = await login({ identifier, password });
      if ("twoFactorRequired" in result && result.twoFactorRequired) {
        setChallengeId(result.challengeId);
        setCode("");
        setResendNote("We emailed you a 6-digit code.");
      } else if ("deleted" in result) {
        navigate("/account-deleted", {
          replace: true,
          state: {
            id: result.id,
            identifier: result.identifier,
            deletedAt: result.deletedAt,
            remainingMs: result.remainingMs,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(submitted?: string) {
    const value = submitted ?? code;
    if (!challengeId || value.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      await verifyTwoFactorLogin(challengeId, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!challengeId) return;
    setError(null);
    setResendNote(null);
    try {
      const res = await resendTwoFactorLogin({ challengeId });
      setResendNote(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend the code");
    }
  }

  function backToPassword() {
    setChallengeId(null);
    setCode("");
    setError(null);
    setResendNote(null);
  }

  return (
    <AuthLayout>
      <div className="flex w-full flex-col gap-5">
        <Branding />

        <div className="flex w-full flex-col items-center justify-center">
          <h2 className="text-2xl font-semibold text-gray-900">
            {challengeId ? "Enter your code" : "Welcome back!"}
          </h2>
          <p className="text-center text-gray-500">
            {challengeId
              ? "Check your email for the 6-digit verification code."
              : "Log in to continue your conversations"}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {challengeId ? (
          <div className="flex w-full flex-col gap-4">
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(c) => void handleVerify(c)}
              disabled={loading}
              autoFocus
            />
            {resendNote && !error && (
              <p className="text-center text-sm text-gray-500">{resendNote}</p>
            )}
            <Button
              value="Verify"
              loading={loading}
              loadingText="Verifying..."
              disabled={code.length !== 6}
              onClick={() => void handleVerify()}
            />
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={backToPassword}
                disabled={loading}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="font-semibold text-brand-600"
              >
                Resend code
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex w-full flex-col gap-4">
              <Input
                label="Email"
                name="identifier"
                icon={<Mail />}
                type="text"
                placeholder="me@example.com"
                value={identifier}
                disabled={loading}
                onChange={(event) => setIdentifier(event.target.value)}
              />
              <PasswordInput
                label="Password"
                name="password"
                placeholder="Enter your password"
                value={password}
                disabled={loading}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-brand-600"
                aria-disabled={loading}
              >
                Forgot Password?
              </Link>
            </div>

            <Button
              value="Log in"
              loading={loading}
              loadingText="Logging in..."
              onClick={handleLogin}
            />

            <Divider />

            <p className="text-center">
              Don't have an account?{" "}
              <Link to="/signup" className="font-semibold text-brand-600">
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
