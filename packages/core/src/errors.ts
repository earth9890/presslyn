/**
 * Base error class for all Presslyn errors.
 */
export class PresslynError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = "PresslynError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends PresslynError {
  constructor(resource: string, id?: string | number) {
    const msg = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(msg, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends PresslynError {
  constructor(message: string = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends PresslynError {
  constructor(message: string = "Forbidden") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends PresslynError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}
