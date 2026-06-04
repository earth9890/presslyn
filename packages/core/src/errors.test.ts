import { describe, it, expect } from "vitest";
import {
  PresslynError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "./errors.js";

describe("PresslynError", () => {
  it("should have correct properties", () => {
    const err = new PresslynError("test", "TEST_CODE", 500);
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST_CODE");
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe("PresslynError");
    expect(err instanceof Error).toBe(true);
  });

  it("should default to 500 status code", () => {
    const err = new PresslynError("test", "CODE");
    expect(err.statusCode).toBe(500);
  });
});

describe("NotFoundError", () => {
  it("should be 404 with resource name", () => {
    const err = new NotFoundError("User");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("User not found");
  });

  it("should include id in message when provided", () => {
    const err = new NotFoundError("Post", 42);
    expect(err.message).toBe("Post with id 42 not found");
  });
});

describe("UnauthorizedError", () => {
  it("should be 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });
});

describe("ForbiddenError", () => {
  it("should be 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });
});

describe("ValidationError", () => {
  it("should be 400", () => {
    const err = new ValidationError("Bad input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Bad input");
  });
});
