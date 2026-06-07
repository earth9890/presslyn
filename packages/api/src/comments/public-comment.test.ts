import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@presslyn/core";
import {
  assertPublicCommentTarget,
  PublicCommentSubmissionSchema,
} from "./public-comment.js";

describe("PublicCommentSubmissionSchema", () => {
  it("requires a trimmed guest name and valid email", () => {
    expect(() =>
      PublicCommentSubmissionSchema.parse({
        postId: 1,
        authorName: " ",
        authorEmail: "writer@example.com",
        content: "Hello",
      })
    ).toThrow();

    const parsed = PublicCommentSubmissionSchema.parse({
      postId: 1,
      authorName: " Writer ",
      authorEmail: "writer@example.com",
      content: "Hello",
    });

    expect(parsed.authorName).toBe("Writer");
  });
});

describe("assertPublicCommentTarget", () => {
  it("rejects honeypot, unpublished posts, and mismatched parent comments", async () => {
    await expect(
      assertPublicCommentTarget(
        {
          getPostById: vi.fn(async () => ({
            status: "publish",
            commentStatus: "open",
          })),
        },
        {
          getCommentById: vi.fn(async () => ({ postId: 1 })),
        },
        { postId: 1, website: "https://spam.example" }
      )
    ).rejects.toThrow(ValidationError);

    await expect(
      assertPublicCommentTarget(
        {
          getPostById: vi.fn(async () => ({
            status: "draft",
            commentStatus: "open",
          })),
        },
        {
          getCommentById: vi.fn(async () => ({ postId: 1 })),
        },
        { postId: 1 }
      )
    ).rejects.toThrow("published");

    await expect(
      assertPublicCommentTarget(
        {
          getPostById: vi.fn(async () => ({
            status: "publish",
            commentStatus: "open",
          })),
        },
        {
          getCommentById: vi.fn(async () => ({ postId: 2 })),
        },
        { postId: 1, parentId: 4 }
      )
    ).rejects.toThrow("Parent comment");
  });

  it("accepts valid published/open comment targets", async () => {
    await expect(
      assertPublicCommentTarget(
        {
          getPostById: vi.fn(async () => ({
            status: "publish",
            commentStatus: "open",
          })),
        },
        {
          getCommentById: vi.fn(async () => ({ postId: 1 })),
        },
        { postId: 1, parentId: 3 }
      )
    ).resolves.toBeUndefined();
  });
});
