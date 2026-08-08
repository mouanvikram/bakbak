import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getMe } from "../lib/api";
import { useAuthStore } from "../stores/auth-store";

export function useCurrentUser() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  return {
    ...query,
    user: query.data ?? user,
  };
}
