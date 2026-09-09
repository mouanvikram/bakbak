import { Router } from "express";
import type { Request, Response } from "express";
import { versionResponseSchema } from "@bakbak/contracts";
import { validateResponse } from "@/middleware/validate";
import { systemConfig } from "./config";
import { HTTP_STATUS } from "@/errors/app-error";

export const systemRoutes = Router();

// Public. Lets the client detect a stale bundle.
systemRoutes.get("/", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  return validateResponse(res, HTTP_STATUS.OK, versionResponseSchema, {
    version: systemConfig.appVersion,
    commit: systemConfig.gitCommit,
    buildTime: systemConfig.buildTime,
  });
});
