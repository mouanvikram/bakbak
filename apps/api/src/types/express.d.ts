import "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      /**
       * Data that passed a `validate()` middleware, keyed by request source.
       * Populated per-source; a handler reads only the sources it validated.
       */
      valid?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}
