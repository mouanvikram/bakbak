import { Link } from "react-router";
import { Background } from "../../../components/ui/Background";
import { Button } from "../../../components/ui/Button";
import { Divider } from "../../../components/ui/Divider";
import { Logo } from "../../../components/ui/Logo";

export function LoginPage() {
  return (
    <Background>
      <div className="flex h-screen w-full items-center justify-center">
        <div className="w-full max-w-md rounded-4xl bg-white p-10 shadow-xl border border-gray-50">
          <div className="flex w-full flex-col gap-6">
            {/* Branding */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-row items-center gap-5">
                <Logo width={60} height={60} />
                <h1 className="text-5xl font-bold">BakBak</h1>
              </div>

              <div className="text-gray-500">
                Chat more. Connect better.
              </div>
            </div>

            {/* Heading */}
            <div className="w-full flex flex-col justify-center items-center">
              <h2 className="text-2xl font-semibold">
                Welcome back!
              </h2>

              <p className="text-gray-500">
                Login to continue your conversations
              </p>
            </div>

            {/* Form */}
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-1">
                <label htmlFor="username">
                  Email or Username
                </label>

                <input
                  id="username"
                  type="text"
                  name="username"
                  className="rounded-md border px-3 py-2"
                />
              </div>

              <div className="flex w-full flex-col gap-1">
                <label htmlFor="password">
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  name="password"
                  className="rounded-md border px-3 py-2"
                />
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-[#4C18EF]"
              >
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
              <Link
                to="/signup"
                className="font-medium text-[#4C18EF]"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Background>
  );
}