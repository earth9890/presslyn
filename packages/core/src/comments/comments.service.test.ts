import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommentsService } from "./comments.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => (row: Record<string, unknown>) => row[field] === value,
  and:
    (...predicates: Array<(row: Record<string, unknown>) => boolean>) =>
    (row: Record<string, unknown>) =>
      predicates.every((predicate) => predicate(row)),
  desc: () => "desc",
  asc: () => "asc",
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ strings, values }) as unknown as T,
}));

vi.mock("@presslyn/database", () => ({
  comments: {
    id: "id",
    postId: "postId",
    authorId: "authorId",
    authorName: "authorName",
    authorEmail: "authorEmail",
    content: "content",
    parentId: "parentId",
    approved: "approved",
    createdAt: "createdAt",
  },
  posts: {
    id: "id",
    siteId: "siteId",
    commentStatus: "commentStatus",
  },
}));

interface PostRow {
  id: number;
  siteId: number;
  commentStatus: "open" | "closed";
}

interface CommentRow {
  id: number;
  postId: number;
  authorId: number | null;
  authorName: string;
  authorEmail: string;
  content: string;
  parentId: number | null;
  approved: boolean;
  createdAt: Date;
}

function createMockDb(initialPosts: PostRow[], initialComments: CommentRow[]) {
  let postsRows = initialPosts.map((row) => ({ ...row }));
  let commentsRows = initialComments.map((row) => ({ ...row }));

  const queryResult = <T,>(result: T[]) => ({
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(result).then(resolve),
    limit: vi.fn(async (limit: number) => result.slice(0, limit)),
    orderBy: vi.fn(() => ({
      limit: vi.fn((limit: number) => ({
        offset: vi.fn(async (offset: number) => result.slice(offset, offset + limit)),
      })),
    })),
    groupBy: vi.fn(async () => {
      const approvedMap = new Map<boolean, number>();
      for (const row of result as Array<Record<string, unknown>>) {
        const approved = Boolean(row.approved);
        approvedMap.set(approved, (approvedMap.get(approved) ?? 0) + 1);
      }
      return [...approvedMap.entries()].map(([approved, count]) => ({ approved, count }));
    }),
  });

  const joinedRows = () =>
    commentsRows.map((comment) => ({
      comment,
      ...comment,
      post: postsRows.find((post) => post.id === comment.postId)!,
      siteId: postsRows.find((post) => post.id === comment.postId)!.siteId,
      commentStatus: postsRows.find((post) => post.id === comment.postId)!.commentStatus,
    }));

  return {
    select: vi.fn((shape?: Record<string, unknown>) => ({
      from: vi.fn((table: Record<string, string>) => {
        const isPosts = "commentStatus" in table;
        if (isPosts) {
          return {
            where: vi.fn((predicate: (row: PostRow) => boolean) =>
              queryResult(
                postsRows
                  .filter(predicate)
                  .map((row) =>
                    shape
                      ? Object.fromEntries(
                          Object.keys(shape).map((key) => [key, row[key as keyof PostRow]])
                        )
                      : { ...row }
                  )
              )
            ),
          };
        }

        return {
          innerJoin: vi.fn(() => ({
            where: vi.fn((predicate: (row: Record<string, unknown>) => boolean) =>
              queryResult(
                joinedRows()
                  .filter(predicate)
                  .map((row) =>
                    shape?.comment
                      ? { comment: { ...row.comment } }
                      : shape
                        ? Object.fromEntries(
                            Object.keys(shape).map((key) => [key, row[key]])
                          )
                        : { ...row.comment }
                  )
              )
            ),
          })),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: Partial<CommentRow>) => ({
        returning: vi.fn(async () => {
          const created: CommentRow = {
            id: commentsRows.length + 1,
            postId: Number(value.postId),
            authorId: (value.authorId as number | null | undefined) ?? null,
            authorName: String(value.authorName ?? ""),
            authorEmail: String(value.authorEmail ?? ""),
            content: String(value.content ?? ""),
            parentId: (value.parentId as number | null | undefined) ?? null,
            approved: Boolean(value.approved),
            createdAt: new Date(),
          };
          commentsRows.push(created);
          return [{ ...created }];
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Partial<CommentRow>) => ({
        where: vi.fn((predicate: (row: CommentRow) => boolean) => ({
          returning: vi.fn(async () => {
            commentsRows = commentsRows.map((row) =>
              predicate(row) ? { ...row, ...value } : row
            );
            return commentsRows.filter(predicate).map((row) => ({ ...row }));
          }),
        })),
      })),
    })),
    transaction: vi.fn(async (callback: (tx: never) => Promise<void>) => {
      await callback({
        update: () => ({
          set: () => ({
            where: async () => [],
          }),
        }),
        delete: () => ({
          where: async () => [],
        }),
      } as never);
    }),
  } as never;
}

describe("CommentsService multisite scoping", () => {
  let service: CommentsService;

  beforeEach(() => {
    service = new CommentsService(
      createMockDb(
        [
          { id: 1, siteId: 1, commentStatus: "open" },
          { id: 2, siteId: 2, commentStatus: "open" },
        ],
        [
          {
            id: 1,
            postId: 1,
            authorId: null,
            authorName: "Primary",
            authorEmail: "primary@example.com",
            content: "Primary comment",
            parentId: null,
            approved: true,
            createdAt: new Date("2026-06-07T00:00:00.000Z"),
          },
          {
            id: 2,
            postId: 2,
            authorId: null,
            authorName: "Docs",
            authorEmail: "docs@example.com",
            content: "Docs comment",
            parentId: null,
            approved: true,
            createdAt: new Date("2026-06-07T00:00:00.000Z"),
          },
        ]
      )
    );
  });

  it("gets a comment only within the requested site", async () => {
    await expect(service.getCommentById(1, { siteId: 1 })).resolves.toMatchObject({
      id: 1,
      content: "Primary comment",
    });
    await expect(service.getCommentById(1, { siteId: 2 })).rejects.toThrow("Comment");
  });

  it("filters queried comments by site", async () => {
    const result = await service.queryComments({}, { siteId: 2 });
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.content).toBe("Docs comment");
  });

  it("creates comments only for posts inside the requested site", async () => {
    await expect(
      service.createComment(
        {
          postId: 1,
          authorName: "Guest",
          authorEmail: "guest@example.com",
          content: "Hello",
        },
        { siteId: 2 }
      )
    ).rejects.toThrow("Post");
  });
});
