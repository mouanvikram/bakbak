import { useState } from "react";
import { Link } from "react-router";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Branding } from "@/components/ui/Branding";
import { useAuth } from "@/features/auth/auth-context";

export function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      await login({ identifier, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthLayout>
      <div className="flex w-full flex-col gap-5">
        {/* Branding */}
        <Branding />

        {/* Heading */}
        <div className="flex w-full flex-col items-center justify-center">
          <h2 className="text-2xl font-semibold text-gray-900">
            Welcome back!
          </h2>

          <p className="text-gray-500">Log in to continue your conversations</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="flex w-full flex-col gap-4">
          <Input
            label="Email"
            name="identifier"
            icon={<Mail />}
            type="text"
            placeholder="me@example.com"
            value={identifier}
            disabled={loading}
            onChange={(event) => {
              setIdentifier(event.target.value);
            }}
          />
          <PasswordInput
            label="Password"
            name="password"
            placeholder="Enter your password"
            value={password}
            disabled={loading}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
        </div>

        {/* Forgot password */}
        <div className="text-right">
          <Link
            to="/forgot-password"
            className="text-sm text-[#4C18EF]"
            aria-disabled={loading}
          >
            Forgot Password?
          </Link>
        </div>

        {/* Login */}
        <Button
          value="Log in"
          loading={loading}
          loadingText="Logging in..."
          onClick={handleLogin}
        />

        {/* Divider */}
        <Divider />

        {/* Signup */}
        <p className="text-center">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-[#4C18EF]">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
