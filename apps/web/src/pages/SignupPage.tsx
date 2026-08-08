import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { getErrorMessage, signup } from "../lib/api";
import { Button, Input, Spinner } from "../components/ui";

export function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    displayName: "",
    firstname: "",
    lastname: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      signup({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
        firstname: form.firstname.trim() || undefined,
        lastname: form.lastname.trim() || undefined,
      }),
    onSuccess: () => {
      setSuccess(
        "Account created! Check your email to verify, then sign in.",
      );
      setTimeout(() => navigate("/login"), 2500);
    },
    onError: (err) => {
      setError(getErrorMessage(err, "Could not create account."));
    },
  });

  const onChange =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    mutation.mutate();
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-seal-900 via-seal-800 to-accent p-4">
      <div className="w-full max-w-md animate-fade-in rounded-2xl bg-surface p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
            <MessageCircle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Create account</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Join SealChat and start messaging
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                First name
              </label>
              <Input
                value={form.firstname}
                onChange={onChange("firstname")}
                placeholder="Alex"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Last name
              </label>
              <Input
                value={form.lastname}
                onChange={onChange("lastname")}
                placeholder="Seal"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Display name
            </label>
            <Input
              value={form.displayName}
              onChange={onChange("displayName")}
              placeholder="How others see you"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Username
            </label>
            <Input
              value={form.username}
              onChange={onChange("username")}
              placeholder="alexseal"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Email
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={onChange("email")}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Password
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={onChange("password")}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              {success}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Spinner /> : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
