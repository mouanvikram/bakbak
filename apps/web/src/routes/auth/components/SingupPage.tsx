import { Link } from "react-router";
import { Background } from "../../../components/ui/Background";
import { Button } from "../../../components/ui/Button";
import { Divider } from "../../../components/ui/Divider";
import { Logo } from "../../../components/ui/Logo";
import { Input } from "../../../components/ui/Input";
import { ArrowLeft, ArrowRight, AtSign, Mail, User } from "lucide-react";
import { PasswordInput } from "../../../components/ui/PasswordInput";
import { useState } from "react";

export function SignupPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  return (
    <Background>
      <div className="flex min-h-screen w-full items-start justify-center pt-20">
        <div className="w-full max-w-md rounded-4xl border border-gray-50 bg-white p-10 shadow-xl">
          <div className="flex w-full flex-col gap-6">
            {/* Branding */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-row items-center gap-5">
                <Logo width={60} height={60} />
                <h1 className="text-5xl font-bold">BakBak</h1>
              </div>

              <div className="text-gray-500">Chat more. Connect better.</div>
            </div>

            {/* Heading */}
            {step !== 4 && (
              <div className="flex w-full flex-col items-center justify-center">
                <h2 className="text-2xl font-semibold">Create Your Account</h2>

                <p className="text-gray-500">
                  Sign up to start chatting with your friends
                </p>
              </div>
            )}

            {/* Form */}
            <div className="flex w-full flex-col gap-4">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2">
                {step === 4 && (
                  <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#805FF8]/10">
                      <Mail className="h-8 w-8 text-[#4C18EF]" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <h2 className="text-xl font-semibold text-gray-900">
                        Verify your email
                      </h2>

                      <p className="text-sm leading-6 text-gray-500">
                        A verification link has been sent to your email address.
                        Please check your inbox and click the link to verify
                        your account.
                      </p>
                    </div>

                    <p className="text-sm text-gray-400">
                      Didn't receive the email?{" "}
                      <Link
                        to="/resend-verification"
                        type="button"
                        className="font-medium text-[#4C18EF] hover:underline"
                      >
                        Resend verification email
                      </Link>
                    </p>
                  </div>
                )}
                {step !== 4 && (
                  <>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        step === 1 ? "bg-[#4C18EF]" : "bg-gray-200"
                      }`}
                    />

                    <div
                      className={`h-2 w-2 rounded-full ${
                        step === 2 ? "bg-[#4C18EF]" : "bg-gray-200"
                      }`}
                    />
                    <div
                      className={`h-2 w-2 rounded-full ${
                        step === 3 ? "bg-[#4C18EF]" : "bg-gray-200"
                      }`}
                    />
                  </>
                )}
              </div>

              {/* STEP 1 */}
              {step === 1 && (
                <>
                  {/* Avatar */}

                  {/* First + Last Name */}
                  <div className="grid w-full grid-cols-2 gap-3">
                    <Input
                      label="First Name"
                      name="firstName"
                      type="text"
                      placeholder="First name"
                      icon={<User size={18} />}
                    />

                    <Input
                      label="Last Name"
                      name="lastName"
                      type="text"
                      placeholder="Last name"
                      icon={<User size={18} />}
                    />
                  </div>

                  {/* Display Name */}
                  <Input
                    label="Display Name"
                    name="displayName"
                    type="text"
                    placeholder="How should we call you?"
                    icon={<User size={18} />}
                  />

                  {/* Date of Birth */}
                  <div className="flex w-full flex-col gap-2">
                    <label
                      htmlFor="dateOfBirth"
                      className="text-md font-semibold text-gray-900"
                    >
                      Date of Birth
                    </label>

                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 transition outline-none focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10"
                    />
                  </div>

                  {/* Next */}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 transition hover:bg-gray-50 active:translate-y-px"
                  >
                    Choose Username
                    <ArrowRight size={18} />
                  </button>
                </>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <>
                  {/* Username */}
                  <Input
                    label="Username"
                    name="username"
                    type="text"
                    placeholder="username"
                    icon={<AtSign size={18} />}
                  />

                  {/* Email */}
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    icon={<Mail size={18} />}
                  />

                  {/* Password */}
                  <PasswordInput
                    label="Password"
                    name="password"
                    placeholder="Create a password"
                  />

                  <p className="-mt-2 text-xs text-gray-400">
                    Use at least 8 characters with a mix of letters, numbers &
                    symbols
                  </p>

                  {/* Confirm Password */}
                  {/* <PasswordInput
                    label="Confirm Password"
                    name="confirmPassword"
                    placeholder="Confirm your password"
                  /> */}

                  {/* Navigation */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                    >
                      <ArrowLeft size={18} />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 transition hover:bg-gray-50 active:translate-y-px"
                    >
                      Upload Picture
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <label
                      htmlFor="avatar"
                      className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 transition hover:border-[#805FF8] hover:text-[#805FF8]"
                    >
                      Avatar
                    </label>

                    <input
                      id="avatar"
                      name="avatar"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                    />

                    <p className="text-xs text-gray-400">
                      Upload a profile picture
                    </p>
                  </div>
                  {/* Bio */}
                  <div className="flex w-full flex-col gap-2">
                    <label
                      htmlFor="bio"
                      className="text-md font-semibold text-gray-900"
                    >
                      Bio
                    </label>

                    <textarea
                      id="bio"
                      name="bio"
                      rows={3}
                      maxLength={160}
                      placeholder="Tell us a little about yourself..."
                      className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10"
                    />
                  </div>
                  {/* Signup or go back */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                    >
                      <ArrowLeft size={18} />
                      Back
                    </button>

                    <div className="flex-1">
                      <Button value="Sign Up" onClick={() => setStep(4)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {step !== 4 && <Divider />}

            {step !== 4 && (
              <p className="text-center">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-[#4C18EF]">
                  Log in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </Background>
  );
}
