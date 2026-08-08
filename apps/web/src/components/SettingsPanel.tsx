import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, updateMe } from "../lib/api";
import { getDisplayName } from "../lib/utils";
import type { MeProfile } from "../types/api";
import { Avatar, Button, Input, Spinner, Textarea } from "./ui";

export function SettingsPanel({ user }: { user?: MeProfile | null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    displayName: "",
    firstName: "",
    lastName: "",
    bio: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      bio: user.bio ?? "",
    });
  }, [user]);

  const mutation = useMutation({
    mutationFn: () =>
      updateMe({
        displayName: form.displayName.trim() || undefined,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        bio: form.bio.trim() || undefined,
      }),
    onSuccess: () => {
      setMessage("Profile updated");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => {
      setError(getErrorMessage(err, "Could not update profile"));
      setMessage(null);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const name = getDisplayName(user);

  return (
    <div className="scroll-thin h-full overflow-y-auto bg-surface p-4 md:p-6">
      <div className="mx-auto max-w-xl animate-fade-in space-y-6">
        <div>
          <h2 className="text-xl font-bold text-ink">Settings</h2>
          <p className="text-sm text-ink-muted">Manage your profile</p>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2 p-4">
          <Avatar name={name} src={user?.avatar} size="xl" />
          <div>
            <p className="font-semibold text-ink">{name}</p>
            <p className="text-sm text-ink-muted">@{user?.username}</p>
            {user?.email && (
              <p className="text-xs text-ink-muted">{user.email}</p>
            )}
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-surface-2 p-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Display name
            </label>
            <Input
              value={form.displayName}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                First name
              </label>
              <Input
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Last name
              </label>
              <Input
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Bio
            </label>
            <Textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="A short intro…"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
          {message && (
            <p className="text-sm text-accent">{message}</p>
          )}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : "Save changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}
