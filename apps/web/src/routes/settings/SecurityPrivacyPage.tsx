import { useState } from "react";
import { changePassword } from "@/api/auth.api";

export function SecurityPrivacyPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);

  async function handleChangePassword() {
    setError("");
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Security & Privacy</h1>
        <p className="text-sm text-gray-500">Manage your password and security preferences</p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">Current Password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" placeholder="Enter current password" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">New Password</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" placeholder="Enter new password" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">Confirm New Password</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10" placeholder="Confirm new password" />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-green-600">Password updated!</span>}
            <button type="button" onClick={handleChangePassword} disabled={loading} className="cursor-pointer rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-6 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="font-semibold text-gray-900">Enable 2FA Authentication</p>
              <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
            </div>
            <button type="button" onClick={() => setTwoFactor(!twoFactor)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${twoFactor ? "bg-[#805FF8]" : "bg-gray-200"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${twoFactor ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
