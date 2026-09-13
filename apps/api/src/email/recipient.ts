// Pure decision logic for sendEmail's recipient handling — exported for tests.
// Non-prod mail is always redirected to DEV_INBOX; production mail must never
// fall back to a personal inbox, so a null recipient is a caller bug and fails
// loudly instead of silently mailing the developer.
export function resolveRecipient(opts: {
  isProduction: boolean;
  to: string | null;
  devInbox: string;
}): { action: "send"; recipient: string } | { action: "skip" } {
  if (!opts.isProduction) {
    return opts.devInbox
      ? { action: "send", recipient: opts.devInbox }
      : { action: "skip" };
  }

  if (!opts.to) {
    throw new Error("sendEmail requires a non-null recipient in production");
  }

  return { action: "send", recipient: opts.to };
}