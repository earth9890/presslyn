import { describe, it, expect } from "vitest";
import { buildWxr, type WxrData } from "../export/wxr.js";
import { parseWxr } from "./wxr-import.js";

const data: WxrData = {
  site: { title: "Site", description: "d", link: "https://example.com", language: "en-US" },
  authors: [{ id: 1, login: "admin", email: "a@example.com", displayName: "Admin User" }],
  categories: [
    { slug: "news", name: "News" },
    { slug: "sub", name: "Sub", parentSlug: "news" },
  ],
  tags: [{ slug: "tag-a", name: "Tag A" }],
  items: [
    {
      postId: 10,
      title: "Hello & <World>",
      link: "https://example.com/hello",
      date: "2026-01-02T03:04:05.000Z",
      authorLogin: "admin",
      content: "<p>Body with ]]> tricky bits</p>",
      excerpt: "Summary",
      status: "publish",
      type: "post",
      slug: "hello",
      commentStatus: "open",
      categories: [{ slug: "news", name: "News" }],
      tags: [{ slug: "tag-a", name: "Tag A" }],
      comments: [
        {
          id: 5,
          authorName: "Guest",
          authorEmail: "g@example.com",
          content: "Nice post",
          date: "2026-01-03T00:00:00.000Z",
          approved: true,
        },
      ],
    },
    {
      postId: 11,
      title: "About",
      link: "https://example.com/about",
      date: "2026-01-01T00:00:00.000Z",
      authorLogin: "admin",
      content: "<p>About page</p>",
      excerpt: "",
      status: "publish",
      type: "page",
      slug: "about",
      commentStatus: "closed",
      categories: [],
      tags: [],
      comments: [],
    },
  ],
  generatedAt: "2026-06-04T00:00:00.000Z",
};

describe("parseWxr (round-trip with buildWxr)", () => {
  const xml = buildWxr(data);
  const parsed = parseWxr(xml);

  it("recovers authors", () => {
    expect(parsed.authors).toHaveLength(1);
    expect(parsed.authors[0]).toMatchObject({
      login: "admin",
      email: "a@example.com",
      displayName: "Admin User",
    });
  });

  it("recovers categories with parents and tags", () => {
    expect(parsed.categories).toHaveLength(2);
    expect(parsed.categories.find((c) => c.slug === "sub")?.parentSlug).toBe("news");
    expect(parsed.tags).toEqual([{ slug: "tag-a", name: "Tag A" }]);
  });

  it("recovers items with escaped/CDATA content intact", () => {
    expect(parsed.items).toHaveLength(2);
    const post = parsed.items.find((i) => i.slug === "hello")!;
    expect(post.title).toBe("Hello & <World>");
    expect(post.content).toBe("<p>Body with ]]> tricky bits</p>");
    expect(post.type).toBe("post");
    expect(post.status).toBe("publish");
    expect(post.categories).toEqual([{ slug: "news", name: "News" }]);
    expect(post.tags).toEqual([{ slug: "tag-a", name: "Tag A" }]);
  });

  it("separates post_tag from category by domain attribute", () => {
    const post = parsed.items.find((i) => i.slug === "hello")!;
    expect(post.categories.every((c) => c.slug !== "tag-a")).toBe(true);
    expect(post.tags.map((t) => t.slug)).toContain("tag-a");
  });

  it("recovers comments and approval flag", () => {
    const post = parsed.items.find((i) => i.slug === "hello")!;
    expect(post.comments).toHaveLength(1);
    expect(post.comments[0]).toMatchObject({
      authorName: "Guest",
      authorEmail: "g@example.com",
      content: "Nice post",
      approved: true,
    });
  });

  it("captures page items and comment status", () => {
    const page = parsed.items.find((i) => i.slug === "about")!;
    expect(page.type).toBe("page");
    expect(page.commentStatus).toBe("closed");
  });

  it("throws on non-WXR input", () => {
    expect(() => parseWxr("<html><body>nope</body></html>")).toThrow();
  });
});
