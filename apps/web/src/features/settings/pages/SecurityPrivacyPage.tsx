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
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Toggle } from "@/components/ui/Toggle";
import { DeleteAccountDialog } from "@/features/settings/components/DeleteAccountDialog";
import { playSound } from "@/lib/sounds";

export function SecurityPrivacyPage() {
  const { deleteAccount, profile } = useAuth();
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
  const [disablePassword, setDisablePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    getSettings()
      .then((res) => setTwoFactor(res.privacy.twoFactorEnabled))
      .catch(() => {});
  }, []);

  async function handleToggleTwoFactor() {
    setTwoFactorError("");
    if (twoFactor) {
      await handleDisableTwoFactor();
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

  async function handleDisableTwoFactor() {
    setTwoFactorError("");
    if (!disablePassword) {
      setTwoFactorError("Enter your current password to turn off 2FA.");
      return;
    }
    setTwoFactorSaving(true);
    try {
      const res = await disableTwoFactor({ password: disablePassword });
      setTwoFactor(res.twoFactorEnabled);
      setTwoFactorSetup(null);
      setDisablePassword("");
      playSound("success");
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : "Couldn't disable 2FA",
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
      playSound("success");
    } catch (err) {
      playSound("otpError");
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
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      playSound("success");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Security & Privacy
        </h1>
        <p className="text-sm text-gray-500">
          Manage your password and security preferences
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Change Password
          </h2>
          <PasswordInput
            label="Current Password"
            name="currentPassword"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <PasswordInput
            label="New Password"
            name="newPassword"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordInput
            label="Confirm New Password"
            name="confirmPassword"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
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
          <h2 className="text-lg font-semibold text-gray-900">
            Two-Factor Authentication
          </h2>
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">
                  Enable 2FA Authentication
                </p>
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

            {twoFactor && !twoFactorSetup && (
              <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
                <PasswordInput
                  label="Current password"
                  name="disablePassword"
                  placeholder="Required to turn off 2FA"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    value="Turn off 2FA"
                    size="sm"
                    fullWidth={false}
                    loading={twoFactorSaving}
                    onClick={() => void handleDisableTwoFactor()}
                  />
                </div>
              </div>
            )}

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
                    className="text-brand-600 text-sm font-semibold disabled:opacity-50"
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
            Deleting your account permanently removes your profile, messages,
            chats, friends and all related data. This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex h-11 w-fit cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 font-bold text-red-600 transition hover:bg-red-100"
          >
            Delete Account
          </button>
        </div>
      </div>

      {deleteOpen && profile && (
        <DeleteAccountDialog
          username={profile.username}
          onConfirm={deleteAccount}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
