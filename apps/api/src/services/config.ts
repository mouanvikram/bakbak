// Services module config — JWT signing identity. The secret is mandatory in
// every environment: fail at boot rather than signing tokens with a fallback.
// The length floor is production-only so test fixtures can stay short.
import { requiredAlways } from "@/config/required";

export const servicesConfig = {
  jwtSecret: requiredAlways(process.env.JWT_SECRET, "JWT_SECRET", {
    minLength: 32,
  }),
  jwtIssuer: process.env.JWT_ISSUER || "bakbak-api",
  jwtAudience: process.env.JWT_AUDIENCE || "bakbak-web",
};
