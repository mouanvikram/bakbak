import { useEffect, useState } from "react";
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor,
} from "@/features/auth/api";
import { useAuth } from "@/features/auth/auth-context";
import { getSettings } from "@/features/settings/api";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { Spinner } from "@/components/ui/Spinner";
import { Toggle } from "@/components/ui/Toggle";

export function SecurityPrivacyPage() {
  const { deleteAccount } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  // Non-null while confirming an enable: a code has been emailed.
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    code: string;
    note: string | null;
  } | null>(null);
  const [twoFactorError, setTwoFactorError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    getSettings()
      .then((res) => setTwoFactor(res.privacy.twoFactorEnabled))
      .catch(() => {});
  }, []);

  async function handleToggleTwoFactor() {
    setTwoFactorError("");
    if (twoFactor) {
      // Turning it off — no code needed, the session is proof enough.
      setTwoFactorSaving(true);
      try {
        const res = await disableTwoFactor();
        setTwoFactor(res.twoFactorEnabled);
        setTwoFactorSetup(null);
      } catch (err) {
        setTwoFactorError(
          err instanceof Error ? err.message : "Couldn't disable 2FA",
        );
      } finally {
        setTwoFactorSaving(false);
      }
      return;
    }

    // Turning it on — email a code and open the confirm step.
    setTwoFactorSaving(true);
    try {
      const res = await setupTwoFactor();
      setTwoFactorSetup({ code: "", note: res.message });
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : "Couldn't start 2FA setup",
      );
    } finally {
      setTwoFactorSaving(false);
    }
  }

  async function handleConfirmEnable(submitted?: string) {
    const value = submitted ?? twoFactorSetup?.code ?? "";
    if (value.length !== 6) return;
    setTwoFactorSaving(true);
    setTwoFactorError("");
    try {
      const res = await enableTwoFactor({ code: value });
      setTwoFactor(res.twoFactorEnabled);
      setTwoFactorSetup(null);
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : "That code didn't work",
      );
      setTwoFactorSetup((s) => (s ? { ...s, code: "" } : s));
    } finally {
      setTwoFactorSaving(false);
    }
  }

  async function handleResendSetup() {
    setTwoFactorError("");
    try {
      const res = await setupTwoFactor();
      setTwoFactorSetup((s) => (s ? { ...s, note: res.message } : s));
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : "Couldn't resend the code",
      );
    }
  }

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

  async function handleDeleteAccount() {
    if (confirmText.trim().toLowerCase() !== "delete") return;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
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
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" placeholder="Enter current password" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">New Password</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" placeholder="Enter new password" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-900">Confirm New Password</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" placeholder="Confirm new password" />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="text-sm text-green-600" role="status">
                Password updated
              </span>
            )}
            <Button
              value="Update password"
              size="lg"
              fullWidth={false}
              loading={loading}
              loadingText="Updating…"
              onClick={handleChangePassword}
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">Enable 2FA Authentication</p>
                <p className="text-sm text-gray-500">
                  We'll email a 6-digit code every time you sign in.
                </p>
              </div>
              <Toggle
                label="Two-factor authentication"
                checked={twoFactor || !!twoFactorSetup}
                disabled={twoFactorSaving}
                onChange={() => handleToggleTwoFactor()}
              />
            </div>

            {twoFactorSetup && (
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-600">
                  {twoFactorSetup.note ??
                    "Enter the 6-digit code we just emailed you."}
                </p>
                <OtpInput
                  value={twoFactorSetup.code}
                  onChange={(next) =>
                    setTwoFactorSetup((s) => (s ? { ...s, code: next } : s))
                  }
                  onComplete={(c) => void handleConfirmEnable(c)}
                  disabled={twoFactorSaving}
                  autoFocus
                />
                <div className="flex items-center gap-3">
                  <Button
                    value="Confirm"
                    size="sm"
                    fullWidth={false}
                    loading={twoFactorSaving}
                    disabled={twoFactorSetup.code.length !== 6}
                    onClick={() => void handleConfirmEnable()}
                  />
                  <button
                    type="button"
                    onClick={handleResendSetup}
                    disabled={twoFactorSaving}
                    className="text-sm font-semibold text-[#4C18EF] disabled:opacity-50"
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorSetup(null);
                      setTwoFactorError("");
                    }}
                    disabled={twoFactorSaving}
                    className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {twoFactorError && (
              <p className="text-sm text-red-600" role="alert">
                {twoFactorError}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
          <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-500">
            Deleting your account permanently removes your profile, messages, chats, friends and all related data. This action cannot be undone.
          </p>
          {!confirmOpen ? (
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(true);
                setConfirmText("");
                setDeleteError("");
              }}
              className="flex h-11 w-fit cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 font-bold text-red-600 transition hover:bg-red-100"
            >
              Delete Account
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">
                To confirm, type <span className="font-bold">delete</span> in the box below.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleting}
                placeholder='Type "delete"'
                className="h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting || confirmText.trim().toLowerCase() !== "delete"}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting && <Spinner />}
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={deleting}
                  className="h-11 cursor-pointer rounded-lg border border-gray-200 bg-white px-6 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
