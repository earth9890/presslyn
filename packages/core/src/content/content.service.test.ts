import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentService } from "./content.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => (row: Record<string, unknown>) => row[field] === value,
  and:
    (...predicates: Array<(row: Record<string, unknown>) => boolean>) =>
    (row: Record<string, unknown>) =>
      predicates.every((predicate) => predicate(row)),
  or:
    (...predicates: Array<((row: Record<string, unknown>) => boolean) | undefined>) =>
    (row: Record<string, unknown>) =>
      predicates.filter(Boolean).some((predicate) => predicate!(row)),
  desc: () => "desc",
  asc: () => "asc",
  like: (field: string, pattern: string) => {
    const needle = pattern.replace(/^%|%$/g, "").toLowerCase();
    return (row: Record<string, unknown>) => String(row[field] ?? "").toLowerCase().includes(needle);
  },
  inArray: () => () => true,
  isNull: (field: string) => (row: Record<string, unknown>) => row[field] == null,
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ strings, values }) as unknown as T,
}));

vi.mock("@presslyn/database", () => ({
  posts: {
    id: "id",
    siteId: "siteId",
    authorId: "authorId",
    postType: "postType",
    title: "title",
    slug: "slug",
    content: "content",
    excerpt: "excerpt",
    status: "status",
    commentStatus: "commentStatus",
    parentId: "parentId",
    menuOrder: "menuOrder",
    meta: "meta",
    publishedAt: "publishedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  postRevisions: { postId: "postId", createdAt: "createdAt" },
  postTerms: { postId: "postId", termId: "termId" },
  terms: { id: "id", name: "name", taxonomyId: "taxonomyId" },
  taxonomies: { id: "id", slug: "slug" },
  users: { id: "id", displayName: "displayName" },
  comments: { postId: "postId" },
  postStatusEnum: { enumValues: ["draft", "publish", "pending", "private", "trash"] },
  sites: { id: "id", isPrimary: "isPrimary" },
}));

interface PostRow {
  id: number;
  siteId: number;
  authorId: number;
  postType: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: "draft" | "publish" | "pending" | "private" | "trash";
  commentStatus: "open" | "closed";
  parentId: number | null;
  menuOrder: number;
  meta: Record<string, unknown>;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function createMockDb(initialPosts: PostRow[]) {
  const postsRows = initialPosts.map((row) => ({ ...row }));

  return {
    select: vi.fn((shape?: Record<string, unknown>) => ({
      from: vi.fn(() => ({
        where: vi.fn((predicate: (row: PostRow) => boolean) => ({
          limit: vi.fn(async (limit: number) => {
            const rows = postsRows.filter(predicate).slice(0, limit);
            return rows.map((row) =>
              shape ? Object.fromEntries(Object.keys(shape).map((key) => [key, row[key as keyof PostRow]])) : { ...row }
            );
          }),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: Partial<PostRow>) => ({
        returning: vi.fn(async () => {
          const created: PostRow = {
            id: postsRows.length + 1,
            siteId: Number(value.siteId ?? 1),
            authorId: Number(value.authorId),
            postType: String(value.postType),
            title: String(value.title),
            slug: String(value.slug),
            content: String(value.content),
            excerpt: String(value.excerpt ?? ""),
            status: (value.status as PostRow["status"]) ?? "draft",
            commentStatus: (value.commentStatus as PostRow["commentStatus"]) ?? "open",
            parentId: (value.parentId as number | null | undefined) ?? null,
            menuOrder: Number(value.menuOrder ?? 0),
            meta: (value.meta as Record<string, unknown> | undefined) ?? {},
            publishedAt: (value.publishedAt as Date | null | undefined) ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          postsRows.push(created);
          return [{ ...created }];
        }),
      })),
    })),
  } as never;
}

describe("ContentService multisite scoping", () => {
  let service: ContentService;

  beforeEach(() => {
    service = new ContentService(
      createMockDb([
        {
          id: 1,
          siteId: 1,
          authorId: 1,
          postType: "post",
          title: "Primary Hello",
          slug: "hello-world",
          content: "hello",
          excerpt: "",
          status: "publish",
          commentStatus: "open",
          parentId: null,
          menuOrder: 0,
          meta: {},
          publishedAt: new Date("2026-06-07T00:00:00.000Z"),
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
        {
          id: 2,
          siteId: 2,
          authorId: 1,
          postType: "post",
          title: "Docs Hello",
          slug: "hello-world",
          content: "docs hello",
          excerpt: "",
          status: "publish",
          commentStatus: "open",
          parentId: null,
          menuOrder: 0,
          meta: {},
          publishedAt: new Date("2026-06-07T00:00:00.000Z"),
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ])
    );
  });

  it("resolves posts by slug within the requested site", async () => {
    const primary = await service.getPostBySlug("hello-world", "post", { siteId: 1 });
    const docs = await service.getPostBySlug("hello-world", "post", { siteId: 2 });

    expect(primary?.title).toBe("Primary Hello");
    expect(docs?.title).toBe("Docs Hello");
  });

  it("reuses the same slug on different sites", async () => {
    const created = await service.createPost(
      {
        siteId: 2,
        authorId: 1,
        title: "Hello World",
        content: "new docs post",
        status: "publish",
      },
      { siteId: 2 }
    );

    expect(created.slug).toBe("hello-world-2");
  });

  it("keeps slug uniqueness scoped to the site", async () => {
    const created = await service.createPost(
      {
        siteId: 3,
        authorId: 1,
        title: "Hello World",
        content: "brand new site",
        status: "publish",
      },
      { siteId: 3 }
    );

    expect(created.slug).toBe("hello-world");
  });
});

// Tailored mock supporting the queryPosts() chain
// (selectDistinct → leftJoin → where → orderBy → limit → offset, plus count).
function createQueryDb(rows: PostRow[]) {
  const filtered = (predicate: (row: PostRow) => boolean) => rows.filter(predicate);

  return {
    selectDistinct: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn((predicate: (row: PostRow) => boolean) => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(async () => filtered(predicate).map((post) => ({ post }))),
              })),
            })),
          })),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(async (predicate: (row: PostRow) => boolean) => [
            { count: filtered(predicate).length },
          ]),
        })),
      })),
    })),
  } as never;
}

describe("ContentService search", () => {
  let service: ContentService;

  beforeEach(() => {
    const base = {
      siteId: 1,
      authorId: 1,
      postType: "post",
      excerpt: "",
      status: "publish" as const,
      commentStatus: "open" as const,
      parentId: null,
      menuOrder: 0,
      meta: {},
      publishedAt: new Date("2026-06-07T00:00:00.000Z"),
      createdAt: new Date("2026-06-07T00:00:00.000Z"),
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    };
    service = new ContentService(
      createQueryDb([
        { ...base, id: 1, title: "Release notes", slug: "p1", content: "the dashboard got faster" },
        { ...base, id: 2, title: "Dashboard tips", slug: "p2", content: "some tips" },
      ])
    );
  });

  it("matches the search term against post content, not just the title", async () => {
    // "faster" appears only in post 1's content, not its title
    const result = await service.queryPosts({ search: "faster" }, { siteId: 1 });

    expect(result.total).toBe(1);
    expect(result.posts[0]?.id).toBe(1);
  });

  it("still matches the search term against the title", async () => {
    // "Release" appears only in post 1's title
    const result = await service.queryPosts({ search: "Release" }, { siteId: 1 });

    expect(result.total).toBe(1);
    expect(result.posts[0]?.id).toBe(1);
  });
});
