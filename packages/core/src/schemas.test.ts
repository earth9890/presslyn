import { describe, it, expect } from "vitest";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserListSchema,
  LoginSchema,
  CreatePostSchema,
  UpdatePostSchema,
  PostQuerySchema,
  CreateTaxonomySchema,
  CreateTermSchema,
  UpdateTermSchema,
  TermQuerySchema,
  CreateCommentSchema,
  CommentQuerySchema,
} from "./schemas.js";

describe("CreateUserSchema", () => {
  it("should accept valid input", () => {
    const result = CreateUserSchema.parse({
      email: "test@example.com",
      username: "testuser",
      password: "securepass",
      displayName: "Test User",
    });
    expect(result.email).toBe("test@example.com");
  });

  it("should reject invalid email", () => {
    expect(() =>
      CreateUserSchema.parse({
        email: "not-an-email",
        username: "test",
        password: "securepass",
        displayName: "Test",
      })
    ).toThrow();
  });

  it("should reject short password (< 8 chars)", () => {
    expect(() =>
      CreateUserSchema.parse({
        email: "test@example.com",
        username: "test",
        password: "short",
        displayName: "Test",
      })
    ).toThrow();
  });

  it("should reject long password (> 128 chars)", () => {
    expect(() =>
      CreateUserSchema.parse({
        email: "test@example.com",
        username: "test",
        password: "a".repeat(129),
        displayName: "Test",
      })
    ).toThrow();
  });

  it("should reject username with special characters", () => {
    expect(() =>
      CreateUserSchema.parse({
        email: "test@example.com",
        username: "user name!",
        password: "securepass",
        displayName: "Test",
      })
    ).toThrow();
  });

  it("should accept username with hyphens and underscores", () => {
    const result = CreateUserSchema.parse({
      email: "test@example.com",
      username: "test-user_123",
      password: "securepass",
      displayName: "Test",
    });
    expect(result.username).toBe("test-user_123");
  });

  it("should reject unknown fields (strict mode)", () => {
    expect(() =>
      CreateUserSchema.parse({
        email: "test@example.com",
        username: "test",
        password: "securepass",
        displayName: "Test",
        isAdmin: true, // unknown field
      })
    ).toThrow();
  });
});

describe("LoginSchema", () => {
  it("should accept valid login", () => {
    const result = LoginSchema.parse({ login: "admin", password: "password123" });
    expect(result.login).toBe("admin");
  });

  it("should reject empty login", () => {
    expect(() => LoginSchema.parse({ login: "", password: "pass" })).toThrow();
  });

  it("should reject empty password", () => {
    expect(() => LoginSchema.parse({ login: "admin", password: "" })).toThrow();
  });
});

describe("CreatePostSchema", () => {
  it("should accept valid post input", () => {
    const result = CreatePostSchema.parse({
      authorId: 1,
      title: "Hello World",
      content: "Some content",
    });
    expect(result.title).toBe("Hello World");
  });

  it("should reject non-positive authorId", () => {
    expect(() =>
      CreatePostSchema.parse({ authorId: 0, title: "Test" })
    ).toThrow();
  });

  it("should reject invalid status", () => {
    expect(() =>
      CreatePostSchema.parse({
        authorId: 1,
        title: "Test",
        status: "invalid",
      })
    ).toThrow();
  });

  it("should accept all valid statuses", () => {
    for (const status of ["draft", "publish", "pending", "private"]) {
      const result = CreatePostSchema.parse({ authorId: 1, title: "T", status });
      expect(result.status).toBe(status);
    }
  });
});

describe("PostQuerySchema", () => {
  it("should accept empty object", () => {
    const result = PostQuerySchema.parse({});
    expect(result).toEqual({});
  });

  it("should accept taxonomy and archive filters", () => {
    const result = PostQuerySchema.parse({
      termId: 3,
      year: 2026,
      month: 4,
    });
    expect(result.termId).toBe(3);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(4);
  });

  it("should reject limit over 100", () => {
    expect(() => PostQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it("should reject negative offset", () => {
    expect(() => PostQuerySchema.parse({ offset: -1 })).toThrow();
  });

  it("should reject invalid archive month", () => {
    expect(() => PostQuerySchema.parse({ month: 13 })).toThrow();
  });
});

describe("CreateTaxonomySchema", () => {
  it("should accept valid taxonomy", () => {
    const result = CreateTaxonomySchema.parse({
      name: "Genre",
      slug: "genre",
    });
    expect(result.slug).toBe("genre");
  });

  it("should reject slug with uppercase", () => {
    expect(() =>
      CreateTaxonomySchema.parse({ name: "Genre", slug: "Genre" })
    ).toThrow();
  });

  it("should reject slug with spaces", () => {
    expect(() =>
      CreateTaxonomySchema.parse({ name: "Genre", slug: "my genre" })
    ).toThrow();
  });
});

describe("CreateCommentSchema", () => {
  it("should accept valid comment", () => {
    const result = CreateCommentSchema.parse({
      postId: 1,
      content: "Great post!",
    });
    expect(result.content).toBe("Great post!");
  });

  it("should reject empty content", () => {
    expect(() =>
      CreateCommentSchema.parse({ postId: 1, content: "" })
    ).toThrow();
  });

  it("should reject invalid authorEmail", () => {
    expect(() =>
      CreateCommentSchema.parse({
        postId: 1,
        content: "Hi",
        authorEmail: "not-email",
      })
    ).toThrow();
  });
});

describe("CommentQuerySchema", () => {
  it("should accept empty object", () => {
    const result = CommentQuerySchema.parse({});
    expect(result).toEqual({});
  });

  it("should reject limit over 100", () => {
    expect(() => CommentQuerySchema.parse({ limit: 101 })).toThrow();
  });
});
