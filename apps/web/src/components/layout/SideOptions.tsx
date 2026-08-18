import { MessageCircleMore, Phone, Settings, UsersRound } from "lucide-react";
import { NavLink } from "react-router";
import { Logo } from "../ui/Logo";
import { cn } from "@/lib/utils";

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
  return (
    <nav className="flex h-full w-full flex-col items-center rounded-lg bg-white shadow-md">
      {/* Logo — desktop only */}
      <div className="hidden h-20 w-full flex-col items-center justify-center md:flex">
        <Logo width={32} height={32} />
      </div>

      {/* Navigation */}
      <div className="flex w-full flex-1 flex-row items-center justify-around md:flex-col md:justify-start md:gap-1 md:px-1">
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
        <button
          type="button"
          className="size-10 overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-violet-200"
          aria-label="Open profile"
        >
          <img
            src="/images/placeholders/avatar.png"
            alt="Your profile"
            className="size-full object-cover"
          />
        </button>
      </div>
    </nav>
  );
}

export default SideOptions;
