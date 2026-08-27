import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/api/user.api";

export function AccountPage() {
  const { profile, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setDisplayName(profile.displayName ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  async function handleSave() {
    setLoading(true);
    setSaved(false);
    try {
      await updateProfile({ firstName, lastName, displayName, bio });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
        <p className="text-sm text-gray-500">Manage your profile information</p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">First Name</span>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" placeholder="Enter first name" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">Last Name</span>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" placeholder="Enter last name" />
          </label>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-900">Display Name</span>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" placeholder="Enter display name" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-900">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" placeholder="Tell us about yourself" />
        </label>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          <button type="button" onClick={handleSave} disabled={loading} className="cursor-pointer rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-6 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
