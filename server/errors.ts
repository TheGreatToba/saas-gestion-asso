import type { Request, Response, NextFunction, RequestHandler } from "express";

export type ErrorKind = "business" | "technical";

export interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  kind?: ErrorKind;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly kind: ErrorKind;
  public readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = options.code ?? new.target.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code;
    this.kind = options.kind ?? "business";
    this.details = options.details;
    if (options.cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      kind: "business",
      details,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, {
      statusCode: 409,
      code: "CONFLICT",
      kind: "business",
      details,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Accès interdit", details?: unknown) {
    super(message, {
      statusCode: 403,
      code: "FORBIDDEN",
      kind: "business",
      details,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentification requise", details?: unknown) {
    super(message, {
      statusCode: 401,
      code: "UNAUTHORIZED",
      kind: "business",
      details,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable", details?: unknown) {
    super(message, {
      statusCode: 404,
      code: "NOT_FOUND",
      kind: "business",
      details,
    });
  }
}

export class TechnicalError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, {
      statusCode: 503,
      code: "TECHNICAL_ERROR",
      kind: "technical",
      details,
    });
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Wrap an Express handler to forward both sync and async errors
 * to the global error middleware.
 */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

