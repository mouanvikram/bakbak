// Services module config — JWT signing identity. The secret is mandatory:
// fail at boot rather than signing tokens with a fallback.
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error(
    "JWT_SECRET is missing. Set it in the repo-root .env file (see .env.example).",
  );
}

export const servicesConfig = {
  jwtSecret,
  jwtIssuer: process.env.JWT_ISSUER || "bakbak-api",
  jwtAudience: process.env.JWT_AUDIENCE || "bakbak-web",
};
