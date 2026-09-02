import { Link } from "react-router";
import { Background } from "@/components/ui/Background";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, ArrowRight, AtSign, Mail, User, Trash2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useRef, useState } from "react";
import { Branding } from "@/components/ui/Branding";
import { useAuth } from "@/features/auth/auth-context";
import { ImageCropModal } from "@/components/ImageCropModal";
import { uploadAvatar } from "@/features/auth/api";

interface SignupFormData {
  firstname: string;
  lastname: string;
  displayname: string;
  username: string;
  email: string;
  password: string;
  bio: string;
}

export function SignupPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SignupFormData>({
    firstname: "", lastname: "", displayname: "", username: "", email: "", password: "", bio: "",
  });
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarToken, setAvatarToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setUser((previous) => ({ ...previous, [name]: value }));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG or WebP images are allowed");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCropConfirm(blob: Blob) {
    const file = cropSrc ? new File([blob], "avatar.webp", { type: "image/webp" }) : null;
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const { signup } = useAuth();

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    try {
      await signup({ ...user, avatarToken: avatarToken ?? undefined });
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

  return (
    <Background>
      <div className="flex min-h-screen w-full items-start justify-center pt-20">
        <div className="w-full max-w-md rounded-4xl border border-gray-50 bg-white p-10 shadow-xl">
          <div className="flex w-full flex-col gap-6">
            <Branding />
            {step !== 4 && (
              <div className="flex w-full flex-col items-center justify-center">
                <h2 className="text-2xl font-semibold">Create Your Account</h2>
                <p className="text-gray-500">Sign up to start chatting with your friends</p>
              </div>
            )}
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-center justify-center gap-2">
                {step === 4 && (
                  <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#805FF8]/10">
                      <Mail className="h-8 w-8 text-[#4C18EF]" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-xl font-semibold text-gray-900">Verify your email</h2>
                      <p className="text-sm leading-6 text-gray-500">
                        A verification link has been sent to your email address.
                        Please check your inbox and click the link to verify your account.
                      </p>
                    </div>
                    <p className="text-sm text-gray-400">
                      Didn't receive the email?{" "}
                      <Link to="/resend-verification" className="font-medium text-[#4C18EF] hover:underline">
                        Resend verification email
                      </Link>
                    </p>
                  </div>
                )}
                {step !== 4 && (
                  <>
                    <div className={`h-2 w-2 rounded-full ${step === 1 ? "bg-[#4C18EF]" : "bg-gray-200"}`} />
                    <div className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#4C18EF]" : "bg-gray-200"}`} />
                    <div className={`h-2 w-2 rounded-full ${step === 3 ? "bg-[#4C18EF]" : "bg-gray-200"}`} />
                  </>
                )}
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              )}
              {step === 1 && (
                <>
                  <div className="grid w-full grid-cols-2 gap-3">
                    <Input label="First Name" name="firstname" type="text" placeholder="First name" icon={<User size={18} />} value={user.firstname} onChange={handleChange} />
                    <Input label="Last Name" name="lastname" type="text" placeholder="Last name" icon={<User size={18} />} value={user.lastname} onChange={handleChange} />
                  </div>
                  <Input label="Display Name" name="displayname" type="text" placeholder="How should we call you?" icon={<User size={18} />} value={user.displayname} onChange={handleChange} />
                  <button type="button" onClick={() => setStep(2)} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 transition hover:bg-gray-50 active:translate-y-px">
                    Choose Username <ArrowRight size={18} />
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  <Input label="Username" name="username" type="text" placeholder="username" icon={<AtSign size={18} />} value={user.username} onChange={handleChange} />
                  <Input label="Email" name="email" type="email" placeholder="you@example.com" icon={<Mail size={18} />} value={user.email} onChange={handleChange} />
                  <PasswordInput label="Password" name="password" placeholder="Create a password" value={user.password} onChange={handleChange} />
                  <p className="-mt-2 text-xs text-gray-400">Use at least 12 characters with a mix of uppercase, lowercase, numbers & symbols</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]">
                      <ArrowLeft size={18} /> Back
                    </button>
                    <button type="button" onClick={() => setStep(3)} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 transition hover:bg-gray-50 active:translate-y-px">
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
                        <img src={avatarPreview} alt="Avatar preview" className="h-20 w-20 rounded-full border border-gray-200 object-cover" />
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow transition hover:bg-red-600"
                          aria-label="Remove avatar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <label htmlFor="avatar" className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 transition hover:border-[#805FF8] hover:text-[#805FF8]">Avatar</label>
                        <input ref={fileInputRef} id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
                      </>
                    )}
                    <p className="text-xs text-gray-400">{avatarToken ? "Avatar ready" : "Upload a profile picture"}</p>
                  </div>
                  <div className="flex w-full flex-col gap-2">
                    <label htmlFor="bio" className="text-md font-semibold text-gray-900">Bio</label>
                    <textarea id="bio" name="bio" rows={3} maxLength={160} placeholder="Tell us a little about yourself..." className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" value={user.bio} onChange={handleChange} />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(2)} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]" disabled={loading}>
                      <ArrowLeft size={18} /> Back
                    </button>
                    <div className="flex-1">
                      <Button value="Sign Up" onClick={handleSignUp} loading={loading} />
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
                <Link to="/login" className="font-semibold text-[#4C18EF]">Log in</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </Background>
  );
}
