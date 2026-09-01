import { useState } from "react";
import { MessageCircleMore, Phone, Settings, UsersRound, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { useAuth } from "@/features/auth/auth-context";
import { Spinner } from "@/components/ui/Spinner";

const sideOptions = [
  {
    label: "Chats",
    path: "/chats",
    icon: MessageCircleMore,
  },
  {
    label: "Friends",
    path: "/friends",
    icon: UsersRound,
  },
  {
    label: "Calls",
    path: "/calls",
    icon: Phone,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

function PrimaryNav() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleMobileLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="flex h-full w-full flex-col items-center rounded-lg bg-white shadow-md">
      {/* Navigation */}
      <div className="flex w-full flex-1 flex-row items-center justify-around py-1 md:flex-col md:justify-start md:gap-1 md:px-1">
        {sideOptions.map((option) => {
          const Icon = option.icon;

          return (
            <NavLink
              key={option.path}
              to={option.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors",
                  "md:w-full md:gap-1 md:py-3",
                  isActive && "bg-violet-50 text-violet-600",
                  !isActive &&
                    "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )
              }
            >
              <Icon className="size-5" />

              <span className="hidden md:block">{option.label}</span>
            </NavLink>
          );
        })}

        {/* Logout — mobile only */}
        <button
          type="button"
          aria-label="Logout"
          onClick={handleMobileLogout}
          disabled={loggingOut}
          className="flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 md:hidden"
        >
          {loggingOut ? (
            <Spinner className="size-5" />
          ) : (
            <LogOut className="size-5" />
          )}
          <span className="hidden md:block">Logout</span>
        </button>
      </div>

      {/* User Avatar */}
      <div className="hidden w-full items-center justify-center pb-4 md:flex">
        <UserMenu />
      </div>
    </nav>
  );
}

export default PrimaryNav;