import { Router } from "express";
import type { Request, Response } from "express";
import { versionResponseSchema } from "@bakbak/contracts";
import { validateResponse } from "../middleware/validate";
import { env } from "@/config";

const router = Router();

// Public. Lets the client detect a stale bundle (see apps/web/src/lib/version.ts).
router.get("/", (_req: Request, res: Response) => {
	res.setHeader("Cache-Control", "public, max-age=60");
	return validateResponse(res, 200, versionResponseSchema, {
		version: env.APP_VERSION,
		commit: env.GIT_COMMIT,
		buildTime: env.BUILD_TIME,
	});
});

export default router;
