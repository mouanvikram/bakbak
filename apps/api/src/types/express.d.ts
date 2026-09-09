import "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      //The authenticated caller, set by `authMiddleware`. 
      user?: {
        userId: string;
        username?: string;
        role?: string;
        sessionId?: string;
      };
      // required after data passes through validate() middleware
      valid?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}
