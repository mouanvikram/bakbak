import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  UserRound,
  Shield,
  Bell,
  Palette,
  Monitor,
  MessageCircle,
  CircleHelp,
  CircleAlert,
  LogOut,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { Spinner } from "@/components/ui/Spinner";

type SidebarOption = {
  label: string;
  path: string;
  desc: string;
  icon: React.ElementType;
};

const navigation: Record<string, SidebarOption[]> = {
  "/settings": [
    {
      label: "Account",
      desc: "Profile, username, and email",
      path: "/settings/account",
      icon: UserRound,
    },
    {
      label: "Security & Privacy",
      desc: "Password, 2FA, and privacy",
      path: "/settings/security_privacy",
      icon: Shield,
    },
    {
      label: "Notifications",
      desc: "Messages, sounds, and alerts",
      path: "/settings/notifications",
      icon: Bell,
    },
    {
      label: "Appearance",
      desc: "Theme, wallpaper, and chat view",
      path: "/settings/appearance",
      icon: Palette,
    },
    {
      label: "Chat Settings",
      desc: "Behavior, media, and history",
      path: "/settings/chat_settings",
      icon: MessageCircle,
    },
    {
      label: "Devices",
      desc: "Manage your connected devices",
      path: "/settings/devices",
      icon: Monitor,
    },
    {
      label: "Help & Support",
      desc: "Help center and contact support",
      path: "/settings/help_support",
      icon: CircleHelp,
    },
    {
      label: "About BakBak",
      desc: "Version, terms, and privacy policy",
      path: "/settings/about_bakbak",
      icon: CircleAlert,
    },
  ],
};

export function SettingsSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const section = Object.keys(navigation).find((basePath) =>
    location.pathname.startsWith(basePath),
  );

  const options = section ? navigation[section] : [];

  if (!options.length) {
    return null;
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <div className="px-4 py-3">
        <h2 className="text-lg font-bold text-slate-900">Settings</h2>
      </div>

      <div className="flex flex-col">
        {options.map((option) => {
          return (
            <NavLink
              key={option.path}
              to={option.path}
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3.5 text-sm transition-colors",
                  isActive && "bg-violet-50 text-violet-600",
                  !isActive &&
                    "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )
              }
            >
              {({ isActive }) => {
                const Icon = option.icon;

                return (
                  <>
                    <div
                      className={cn(
                        "flex w-10 items-center justify-center",
                        isActive && "text-violet-600",
                        !isActive && "text-gray-400",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-6 shrink-0",
                          isActive && "text-violet-600",
                          !isActive && "text-gray-400",
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <span
                        className={cn(
                          "font-semibold",
                          isActive && "text-violet-600",
                          !isActive && "text-slate-900",
                        )}
                      >
                        {option.label}
                      </span>

                      {option.desc && (
                        <span className="text-sm text-gray-600">
                          {option.desc}
                        </span>
                      )}
                    </div>
                  </>
                );
              }}
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 border-t border-gray-100 px-4 py-3.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex w-10 items-center justify-center">
            {loggingOut ? (
              <Spinner className="size-6 shrink-0" />
            ) : (
              <LogOut className="size-6 shrink-0" />
            )}
          </div>

          <div className="flex flex-col">
            <span className="font-semibold">
              {loggingOut ? "Logging out..." : "Logout"}
            </span>
            <span className="text-sm text-red-400">
              Sign out of your account
            </span>
          </div>
        </button>
      </div>
    </nav>
  );
}
