// ICE configuration for WebRTC calls: the STUN/TURN servers handed to the
// browser, and the secret used to mint short-lived TURN credentials.
//
// TURN authentication uses coturn's REST-API scheme (`--use-auth-secret`):
// the API and coturn share TURN_STATIC_AUTH_SECRET and never exchange
// per-user passwords. Long-term static credentials are deliberately not
// supported — anything handed to a browser is harvestable, and a working
// TURN login lets a stranger relay their traffic on your bandwidth.
import { positiveNum, str } from "@/config/parse";
import { requiredInProduction } from "@/config/required";

// Comma-separated so one variable can carry the usual udp/tcp pair.
function urlList(value: string | undefined, fallback: string): string[] {
  return str(value, fallback)
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

const staticAuthSecret = requiredInProduction(
  process.env.TURN_STATIC_AUTH_SECRET,
  "TURN_STATIC_AUTH_SECRET",
  { insecureDevDefault: "dev-turn-secret" },
);

// Default to the local coturn from infra/docker-compose.yml, so the dev stack
// works with no configuration. Production must point at a reachable server.
const stunUrls = urlList(process.env.STUN_URLS, "stun:localhost:3478");
const turnUrls = urlList(process.env.TURN_URLS, "turn:localhost:3478");

export const callsConfig = {
  stunUrls,
  turnUrls,
  staticAuthSecret,
  // Must match coturn's `--realm`, or it rejects the credential.
  realm: str(process.env.TURN_REALM, "bakbak.local"),
  // Lifetime of a minted credential. Long enough for a call to outlast a
  // refresh, short enough that a leaked pair stops working quickly.
  credentialTtlSeconds: positiveNum(
    process.env.TURN_CREDENTIAL_TTL_SECONDS,
    3600,
  ),
  // False means the ICE response is STUN-only: calls still connect whenever
  // the peers' NATs permit a direct path, and fail where a relay was needed.
  enabled: Boolean(staticAuthSecret && turnUrls.length > 0),
};
