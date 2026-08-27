import { MessageCircleMore, Phone, Settings, UsersRound } from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

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

function SideOptions() {
  const { profile } = useAuth();
  const avatarUrl = profile?.avatar;
  const displayName = profile?.displayName ?? profile?.username ?? "U";
  return (
    <nav className="flex h-full w-full flex-col items-center rounded-lg bg-white shadow-md">
      {/* Logo — desktop only */}
      {/* <div className="hidden h-20 w-full flex-col items-center justify-center md:flex">
        <Logo width={32} height={32} />
      </div> */}

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
      </div>

      {/* User Avatar */}
      <div className="hidden w-full items-center justify-center pb-4 md:flex">
        <NavLink
          to="/settings"
          className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-sm font-medium text-violet-600 ring-2 ring-transparent transition hover:ring-violet-200"
          aria-label="Open profile"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="size-full object-cover"
            />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </NavLink>
      </div>
    </nav>
  );
}

export default SideOptions;
