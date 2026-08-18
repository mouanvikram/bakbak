import { UserArrowRight } from "@/components/icons/UserArrowRight";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  UserRoundCheck,
  UserRoundArrowLeftIcon,
  LucideUserRoundSearch,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";

type SidebarOption = {
  label: string;
  path: string;
  desc: string;
  icon: React.ElementType;
};

const navigation: Record<string, SidebarOption[]> = {
  "/friends": [
    {
      label: "Search People",
      desc: "Search by name, username",
      path: "/friends/search",
      icon: LucideUserRoundSearch,
    },
    {
      label: "Friends",
      desc: "People you're connected with",
      path: "/friends",
      icon: UserRoundCheck,
    },
    {
      label: "Pending Requests",
      desc: "Friend requests waiting for you",
      path: "/friends/pending",
      icon: UserRoundArrowLeftIcon,
    },
    {
      label: "Sent Requests",
      desc: "Friend requests you've sent",
      path: "/friends/sent",
      icon: UserArrowRight,
    },
    {
      label: "Suggestions",
      desc: "People you might want to connect with",
      path: "/friends/suggestions",
      icon: Sparkles,
    },
  ],
};

export function FriendsSidebar() {
  const location = useLocation();

  const section = Object.keys(navigation).find((basePath) =>
    location.pathname.startsWith(basePath),
  );

  const options = section ? navigation[section] : [];

  if (!options.length) {
    return null;
  }

  return (
    <nav className="flex h-full w-full flex-col overflow-y-auto rounded-lg bg-white p-3 shadow-md">
      <div className="mb-3 px-2">
        <h2 className="text-xl font-semibold">Friends</h2>
      </div>

      <div className="flex flex-col gap-1">
        {options.map((option) => {
          return (
            <NavLink
              key={option.path}
              to={option.path}
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-4 text-sm transition-colors",
                  isActive && "bg-violet-50 text-violet-600",
                  !isActive &&
                    "text-muted-foreground hover:bg-slate-50 hover:text-slate-900",
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
                        !isActive && "text-muted-foreground",
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
      </div>
    </nav>
  );
}
