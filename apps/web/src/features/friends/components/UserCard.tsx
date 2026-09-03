import type { ReactNode } from "react";
import type { SearchUserType } from "@bakbak/contracts";
import { Avatar } from "@/components/ui/Avatar";

type UserLike = Pick<SearchUserType, "username"> & {
  profile?: SearchUserType["profile"];
};

function getDisplayName(user: UserLike): string {
  const name =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") ||
    user.profile?.displayName;
  return name || user.username;
}

export function UserCard({
  user,
  actions,
}: {
  user: UserLike;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={getDisplayName(user)} src={user.profile?.avatar ?? undefined} />
        <div>
          <div className="text-sm font-medium text-gray-900">
            {getDisplayName(user)}
          </div>
          <div className="text-xs text-gray-500">@{user.username}</div>
        </div>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}