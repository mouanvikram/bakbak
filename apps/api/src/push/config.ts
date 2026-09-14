// VAPID identity for outgoing web pushes (RFC 8292). Generate a pair with
// `bunx web-push generate-vapid-keys` and put it in the repo-root .env.
// Missing in dev means push is silently off (GET /api/v1/push/config returns
// null and notifications fall back to socket-only); production requires them.
import { requiredInProduction } from "@/config/required";

const publicKey = requiredInProduction(process.env.VAPID_PUBLIC_KEY, "VAPID_PUBLIC_KEY", {
  devDefault: "",
});
const privateKey = requiredInProduction(
  process.env.VAPID_PRIVATE_KEY,
  "VAPID_PRIVATE_KEY",
  { devDefault: "" },
);
const subject = requiredInProduction(process.env.VAPID_SUBJECT, "VAPID_SUBJECT", {
  devDefault: "mailto:dev@bakbak.local",
});

export const pushConfig = {
  publicKey,
  privateKey,
  subject,
  // True only when a usable keypair is configured.
  enabled: Boolean(publicKey && privateKey),
  // How long the push service should try to deliver (seconds).
  ttlSeconds: 60 * 60 * 24,
};