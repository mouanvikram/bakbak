import { z } from "zod";

// GET /api/v1/version — the running backend's build, for stale-bundle detection.
export const versionResponseSchema = z.object({
	// Release tag / short commit SHA / "dev" when unset.
	version: z.string(),
	commit: z.string(),
	buildTime: z.string(),
});

export type VersionResponseType = z.infer<typeof versionResponseSchema>;
