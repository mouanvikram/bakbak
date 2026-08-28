import { useState } from "react";
import { useNavigate } from "react-router";
import { LogOut, UserRound, X, CalendarDays, Users, Mail, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

function formatJoinDate(iso?: string | null) {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Avatar({ className }: { className?: string }) {
  const { profile } = useAuth();
  const avatarUrl = profile?.avatar;
  const displayName = profile?.displayName ?? profile?.username ?? "U";

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full bg-violet-100 text-sm font-medium text-violet-600",
        className,
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName} className="size-full object-cover" />
      ) : (
        displayName.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function TooltipCard({
  onProfile,
  onLogout,
}: {
  onProfile: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="absolute right-full top-1/2 mr-3 w-44 -translate-y-1/2">
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg",
          "scale-[0.98] opacity-0 blur-[10px]",
          "transition-all duration-200 ease-out",
          "group-hover:scale-100 group-hover:opacity-100 group-hover:blur-0",
        )}
      >
        <button
          type="button"
          onClick={onProfile}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-600"
        >
          <UserRound className="size-4" />
          Profile
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function UserMenu() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const displayName = profile?.displayName ?? profile?.username ?? "User";
  const fullName =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : undefined;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <div className="group relative">
        <Avatar className="size-10 ring-2 ring-transparent transition hover:ring-violet-200" />
        <TooltipCard
          onProfile={() => setOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close profile"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>

            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar className="size-20 text-xl" />
              <div>
                <div className="flex items-center justify-center gap-1.5">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {displayName}
                  </h2>
                  {profile?.verified && (
                    <BadgeCheck className="size-5 text-violet-600" />
                  )}
                </div>
                <p className="text-sm text-slate-500">@{profile?.username}</p>
              </div>
              {fullName && (
                <p className="text-sm text-slate-600">{fullName}</p>
              )}
            </div>

            {profile?.bio && (
              <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {profile.bio}
              </p>
            )}

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="size-4 shrink-0 text-violet-500" />
                <span className="truncate">{profile?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <CalendarDays className="size-4 shrink-0 text-violet-500" />
                <span>Joined {formatJoinDate(profile?.joinedAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="size-4 shrink-0 text-violet-500" />
                <span>{profile?.friendsCount ?? 0} friends</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              <UserRound className="size-4" />
              Edit Profile
            </button>
          </div>
        </div>
      )}
    </>
  );
}
