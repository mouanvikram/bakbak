import { Link, useNavigate } from "react-router";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Check,
  Loader2,
  Mail,
  User,
  Trash2,
  X,
} from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useCallback, useEffect, useRef, useState } from "react";
import { Branding } from "@/components/ui/Branding";
import { useAuth } from "@/features/auth/auth-context";
import { ImageCropModal } from "@/components/ImageCropModal";
import { uploadAvatar } from "@/features/auth/api";
import { checkUsername } from "@/features/users/api";

interface SignupFormData {
  firstname: string;
  lastname: string;
  displayname: string;
  username: string;
  email: string;
  password: string;
  bio: string;
}

type UsernameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; suggestion: string };

function buildSuggestion(username: string): string {
  const base = username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SignupFormData>({
    firstname: "",
    lastname: "",
    displayname: "",
    username: "",
    email: "",
    password: "",
    bio: "",
  });
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({
    state: "idle",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runUsernameCheck = useCallback(async (username: string) => {
    if (!username) {
      setUsernameStatus({ state: "idle" });
      return;
    }
    setUsernameStatus({ state: "checking" });
    try {
      const { available } = await checkUsername(username);
      if (available) {
        setUsernameStatus({ state: "available" });
      } else {
        setUsernameStatus({
          state: "unavailable",
          suggestion: buildSuggestion(username),
        });
      }
    } catch {
      setUsernameStatus({
        state: "unavailable",
        suggestion: buildSuggestion(username),
      });
    }
  }, []);

  function handleUsernameChange(value: string) {
    setUser((previous) => ({ ...previous, username: value }));
    setUsernameStatus({ state: "checking" });

    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);

    if (!value.trim()) {
      setUsernameStatus({ state: "idle" });
      return;
    }
    usernameCheckRef.current = setTimeout(() => {
      runUsernameCheck(value.trim());
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    };
  }, []);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    if (name === "username") {
      handleUsernameChange(value);
      return;
    }
    setUser((previous) => ({ ...previous, [name]: value }));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "image/gif",
        "image/bmp",
      ].includes(file.type)
    ) {
      setError("Only JPG, PNG, WebP, AVIF, GIF or BMP images are allowed");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCropConfirm(blob: Blob) {
    const file = cropSrc
      ? new File([blob], "avatar.webp", { type: "image/webp" })
      : null;
    setUploading(true);
    setError(null);
    try {
      const name = file?.name ?? "avatar.webp";
      const result = await uploadAvatar(blob, name);
      setAvatarToken(result.avatarToken);
      setAvatarPreview(URL.createObjectURL(blob));
      setCropSrc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed");
      setCropSrc(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const { signup } = useAuth();

  async function handleSignUp() {
    const trimmedBio = user.bio.trim();
    if (trimmedBio.length > 0 && trimmedBio.length < 10) {
      setError("Bio must be at least 10 characters, or left blank.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signup({
        ...user,
        bio: trimmedBio || undefined,
        avatarToken: avatarToken ?? undefined,
      });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveAvatar() {
    setAvatarPreview(null);
    setAvatarToken(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function goToStep3() {
    setError(null);
    if (usernameStatus.state !== "available") {
      setError("Username must be available before continuing.");
      return;
    }
    setStep(3);
  }

  function useSuggestion() {
    if (usernameStatus.state !== "unavailable") return;
    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    setUser((previous) => ({
      ...previous,
      username: usernameStatus.suggestion,
    }));
    setUsernameStatus({ state: "checking" });
    usernameCheckRef.current = setTimeout(() => {
      runUsernameCheck(usernameStatus.suggestion);
    }, 300);
  }

  const passwordChecks = [
    { label: "12+ characters", met: user.password.length >= 12 },
    { label: "Uppercase letter", met: /[A-Z]/.test(user.password) },
    { label: "Lowercase letter", met: /[a-z]/.test(user.password) },
    { label: "Number", met: /[0-9]/.test(user.password) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(user.password) },
  ];
  const passwordFilled = passwordChecks.every((c) => c.met);

  const step1Valid = [user.firstname, user.lastname, user.displayname].every(
    (field) => field.trim().length > 0,
  );
  const step2Valid =
    user.username.trim().length >= 4 &&
    usernameStatus.state === "available" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) &&
    passwordFilled;

  return (
    <AuthLayout>
      <div className="flex w-full flex-col gap-4">
        <Branding />
        {step !== 4 && (
          <div className="flex w-full flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold text-gray-900">
              Create your account
            </h2>
            <p className="text-gray-500">
              Sign up to start chatting with your friends
            </p>
          </div>
        )}
        <div className="flex w-full flex-col gap-4">
          <div className="flex items-center justify-center gap-2">
            {step === 4 && (
              <div className="flex w-full flex-col items-center justify-center gap-4 py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10">
                  <Mail className="h-8 w-8 text-brand-600" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Verify your email
                  </h2>
                  <p className="text-sm leading-6 text-gray-500">
                    A verification link has been sent to your email address.
                    Check your inbox and click the link to verify your account,
                    then log in.
                  </p>
                </div>
                <Button
                  value="Go to login"
                  onClick={() => navigate("/login")}
                />
                <p className="text-sm text-gray-500">
                  Didn't receive the email?{" "}
                  <Link
                    to="/resend-verification"
                    className="font-medium text-brand-600 hover:underline"
                  >
                    Resend verification email
                  </Link>
                </p>
              </div>
            )}
            {step !== 4 && (
              <>
                <div
                  className={`h-2 w-2 rounded-full ${step === 1 ? "bg-[#4C18EF]" : "bg-gray-200"}`}
                />
                <div
                  className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#4C18EF]" : "bg-gray-200"}`}
                />
                <div
                  className={`h-2 w-2 rounded-full ${step === 3 ? "bg-[#4C18EF]" : "bg-gray-200"}`}
                />
              </>
            )}
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {step === 1 && (
            <>
              <div className="grid w-full grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  name="firstname"
                  type="text"
                  placeholder="First name"
                  icon={<User size={18} />}
                  value={user.firstname}
                  onChange={handleChange}
                  disabled={loading}
                />
                <Input
                  label="Last Name"
                  name="lastname"
                  type="text"
                  placeholder="Last name"
                  icon={<User size={18} />}
                  value={user.lastname}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <Input
                label="Display Name"
                name="displayname"
                type="text"
                placeholder="How should we call you?"
                icon={<User size={18} />}
                value={user.displayname}
                onChange={handleChange}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid || loading}
                className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 transition hover:bg-gray-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                Choose Username <ArrowRight size={18} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="flex w-full flex-col gap-1">
                <Input
                  label="Username"
                  name="username"
                  type="text"
                  placeholder="username"
                  icon={<AtSign size={18} />}
                  value={user.username}
                  onChange={handleChange}
                  disabled={loading}
                />
                {usernameStatus.state === "checking" && (
                  <p className="text-xs text-gray-400">
                    Checking availability...
                  </p>
                )}
                {usernameStatus.state === "available" && (
                  <p className="flex items-center gap-1 text-xs text-green-600">
                    <Check size={14} /> Username is available
                  </p>
                )}
                {usernameStatus.state === "unavailable" && (
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <X size={14} /> Username is not available
                    </p>
                    <button
                      type="button"
                      onClick={useSuggestion}
                      disabled={loading}
                      className="self-start text-xs font-medium text-[#4C18EF] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Try instead: {usernameStatus.suggestion}
                    </button>
                  </div>
                )}
              </div>
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="you@example.com"
                icon={<Mail size={18} />}
                value={user.email}
                onChange={handleChange}
                disabled={loading}
              />
              <PasswordInput
                label="Password"
                name="password"
                placeholder="Create a password"
                value={user.password}
                onChange={handleChange}
                disabled={loading}
              />
              <div
                className={`-mt-2 flex flex-col gap-1 rounded-lg p-2 transition ${passwordFilled ? "bg-green-50" : "bg-gray-50"}`}
              >
                <p className="text-xs text-gray-500">Password requirements:</p>
                <ul className="grid grid-cols-2 gap-1">
                  {passwordChecks.map((check) => (
                    <li
                      key={check.label}
                      className={`flex items-center gap-1.5 text-xs ${check.met ? "font-medium text-green-600" : "text-gray-400"}`}
                    >
                      {check.met ? <Check size={13} /> : <X size={13} />}
                      {check.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft size={18} /> Back
                </button>
                <button
                  type="button"
                  onClick={goToStep3}
                  disabled={!step2Valid || loading}
                  className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 transition hover:bg-gray-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Upload Picture <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="flex flex-col items-center gap-2">
                {avatarPreview ? (
                  <div className="relative">
                    {uploading ? (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                        <Loader2 className="size-6 animate-spin text-brand-500" />
                      </div>
                    ) : (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="h-20 w-20 rounded-full border border-gray-200 object-cover"
                      />
                    )}
                    {!uploading && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={loading}
                        className={`absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition hover:bg-red-600 ${loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                        aria-label="Remove avatar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor="avatar"
                      className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 transition hover:border-brand-500 hover:text-brand-500 ${loading || uploading ? "cursor-not-allowed opacity-50 hover:border-gray-300 hover:text-gray-400" : "cursor-pointer"}`}
                    >
                      {uploading ? (
                        <Loader2 className="size-6 animate-spin text-brand-500" />
                      ) : (
                        "Avatar"
                      )}
                    </label>
                    <input
                      ref={fileInputRef}
                      id="avatar"
                      name="avatar"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={loading || uploading}
                    />
                  </>
                )}
                <p className="text-xs text-gray-400">
                  {uploading
                    ? "Uploading..."
                    : avatarToken
                      ? "Avatar ready"
                      : "Upload a profile picture"}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                <label
                  htmlFor="bio"
                  className="text-sm font-semibold text-gray-900"
                >
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  maxLength={500}
                  placeholder="Tell us a little about yourself..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  value={user.bio}
                  onChange={handleChange}
                  disabled={loading || uploading}
                />
                <p className="text-xs text-gray-400">
                  Optional — leave blank, or write at least 10 characters.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loading || uploading}
                >
                  <ArrowLeft size={18} /> Back
                </button>
                <div className="flex-1">
                  <Button
                    value="Sign Up"
                    onClick={handleSignUp}
                    loading={loading}
                    disabled={uploading}
                  />
                </div>
              </div>
            </>
          )}
          {cropSrc && (
            <ImageCropModal
              imageSrc={cropSrc}
              onCancel={() => {
                setCropSrc(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              onConfirm={handleCropConfirm}
            />
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
    </AuthLayout>
  );
}
