import { useEffect, useRef, useState } from "react";
import { AtSign, Check, Loader2, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { checkUsername, updateProfile, uploadAvatar } from "@/features/users/api";
import { ImageCropModal } from "@/components/ImageCropModal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

type UsernameStatus =
  | "idle" // unchanged — nothing to check
  | "short" // fewer than 4 characters
  | "checking"
  | "available"
  | "taken";

const inputClass =
  "h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

export function AccountPage() {
  const { profile, refreshUser } = useAuth();
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setUsernameStatus("idle");
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setDisplayName(profile.displayName ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, []);

  function handleUsernameChange(value: string) {
    setUsername(value);
    setError("");
    if (checkTimer.current) clearTimeout(checkTimer.current);

    const next = value.trim();
    if (next === profile?.username) {
      setUsernameStatus("idle");
      return;
    }
    if (next.length < 4) {
      setUsernameStatus("short");
      return;
    }
    setUsernameStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const { available } = await checkUsername(next);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("taken");
      }
    }, 400);
  }

  const usernameBlocked =
    usernameStatus === "checking" ||
    usernameStatus === "short" ||
    usernameStatus === "taken";

  async function handleSave() {
    const trimmedBio = bio.trim();
    if (trimmedBio.length > 0 && trimmedBio.length < 10) {
      setError("Bio must be at least 10 characters, or left blank.");
      return;
    }
    if (usernameBlocked) {
      setError(
        usernameStatus === "short"
          ? "Username must be at least 4 characters."
          : usernameStatus === "taken"
            ? "That username is taken."
            : "Still checking that username…",
      );
      return;
    }

    setError("");
    setLoading(true);
    setSaved(false);
    try {
      await updateProfile({
        username: username.trim(),
        firstName,
        lastName,
        displayName,
        bio: trimmedBio || null,
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/bmp"].includes(file.type)) {
      setError("Only JPG, PNG, WebP, AVIF, GIF or BMP images are allowed");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setUploading(true);
    setError("");
    try {
      await uploadAvatar(blob, "avatar.webp");
      await refreshUser();
      setCropSrc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed");
      setCropSrc(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
        <p className="text-sm text-gray-500">Manage your profile information</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Profile Picture</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Profile"
                  className="h-24 w-24 rounded-full border border-gray-200 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-2xl font-semibold text-violet-600">
                  {(displayName || firstName || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="avatar"
                  className={`flex cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-2.5 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  Upload photo
                </label>
                <input
                  ref={fileInputRef}
                  id="avatar"
                  name="avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </div>
              {uploading && (
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  <Spinner /> Uploading...
                </span>
              )}
              <p className="text-xs text-gray-400">JPG, PNG, WebP, AVIF, GIF or BMP, up to 10 MB.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">Email</span>
            <input
              type="email"
              value={profile?.email ?? ""}
              disabled
              readOnly
              className={inputClass}
            />
            <span className="text-xs text-gray-400">
              Email can’t be changed.
            </span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">Username</span>
            <div className="relative">
              <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                maxLength={30}
                className={cn(inputClass, "w-full pr-10 pl-9")}
                placeholder="username"
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 className="size-4 animate-spin text-gray-400" />
                )}
                {usernameStatus === "available" && (
                  <Check className="size-4 text-green-600" />
                )}
                {usernameStatus === "taken" && (
                  <X className="size-4 text-red-500" />
                )}
              </span>
            </div>
            <span
              className={cn(
                "text-xs",
                usernameStatus === "taken" || usernameStatus === "short"
                  ? "text-red-600"
                  : usernameStatus === "available"
                    ? "text-green-600"
                    : "text-gray-400",
              )}
            >
              {usernameStatus === "short"
                ? "Must be at least 4 characters."
                : usernameStatus === "taken"
                  ? "That username is already taken."
                  : usernameStatus === "available"
                    ? "Username is available."
                    : usernameStatus === "checking"
                      ? "Checking availability…"
                      : "4–30 characters. This is how people find you."}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">First Name</span>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} placeholder="Enter first name" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">Last Name</span>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} placeholder="Enter last name" />
          </label>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-900">Display Name</span>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Enter display name" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-900">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={500} className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" placeholder="Tell us about yourself" />
          <span className="text-xs text-gray-400">
            {bio.trim().length === 0
              ? "Leave blank, or write at least 10 characters."
              : bio.trim().length < 10
                ? `${10 - bio.trim().length} more character${10 - bio.trim().length === 1 ? "" : "s"} needed`
                : `${bio.trim().length}/500`}
          </span>
        </label>
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-sm text-green-600" role="status">
              Saved
            </span>
          )}
          <Button
            value="Save changes"
            size="lg"
            fullWidth={false}
            loading={loading}
            loadingText="Saving…"
            disabled={loading || uploading || usernameBlocked}
            onClick={handleSave}
          />
        </div>
      </div>

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
  );
}
