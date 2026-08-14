import { Link } from "react-router";
import { Background } from "../../../components/ui/Background";
import { Button } from "../../../components/ui/Button";
import { Divider } from "../../../components/ui/Divider";
import { Logo } from "../../../components/ui/Logo";
import { Input } from "../../../components/ui/Input";
import { Mail } from "lucide-react";
import { PasswordInput } from "../../../components/ui/PasswordInput";
import { Branding } from "../../../components/ui/Branding";

export function LoginPage() {
  return (
    <Background>
      <div className="flex min-h-screen w-full items-start justify-center pt-20">
        <div className="w-full max-w-md rounded-4xl border border-gray-50 bg-white p-10 shadow-xl">
          <div className="flex w-full flex-col gap-6">
            {/* Branding */}
            <Branding />

            {/* Heading */}
            <div className="flex w-full flex-col items-center justify-center">
              <h2 className="text-2xl font-semibold">Welcome back!</h2>

              <p className="text-gray-500">
                Login to continue your conversations
              </p>
            </div>

            {/* Form */}
            <div className="flex w-full flex-col gap-4">
              <Input
                label="Email"
                name="identifier"
                icon={<Mail />}
                type="text"
                placeholder="me@example.com"
              />
              <PasswordInput
                label="Password"
                name="password"
                placeholder="Enter your password"
              />
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-[#4C18EF]">
                Forgot Password?
              </Link>
            </div>

            {/* Login */}
            <Button value="Login" />

            {/* Divider */}
            <Divider />

            {/* Signup */}
            <p className="text-center">
              Don't have an account?{" "}
              <Link to="/signup" className="font-semibold text-[#4C18EF]">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Background>
  );
}
