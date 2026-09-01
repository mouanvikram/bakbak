import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { Spinner } from "@/components/ui/Spinner";

type Device = {
  id: string;
  name: string;
  lastActive: string;
  current?: boolean;
};

const devices: Device[] = [
  { id: "current", name: "This device", lastActive: "Active now", current: true },
  { id: "chrome", name: "Chrome on Windows", lastActive: "Last active 2 hours ago" },
  { id: "safari", name: "Safari on iPhone", lastActive: "Last active 1 day ago" },
];

export function DevicesPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleLogout(deviceId: string) {
    setBusyId(deviceId);
    setError("");
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setError("Failed to log out");
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Devices</h1>
        <p className="text-sm text-gray-500">
          Manage your connected devices and sessions
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex flex-col gap-4">
        {devices.map((device) => (
          <div key={device.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{device.name}</p>
                <p className="text-sm text-gray-500">{device.lastActive}</p>
              </div>
              {device.current ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Active
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => handleLogout(device.id)}
                  className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === device.id && <Spinner className="size-3.5" />}
                  Log out
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}