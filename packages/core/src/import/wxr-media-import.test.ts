import { describe, it, expect, vi } from "vitest";
import { parseWxr, importWxr, type FetchLike } from "./wxr-import.js";

const OLD_URL = "https://old.example.com/wp-content/uploads/2024/05/cat.jpg";
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <wp:author>
      <wp:author_login>admin</wp:author_login>
      <wp:author_email>a@example.com</wp:author_email>
      <wp:author_display_name>Admin</wp:author_display_name>
    </wp:author>
    <item>
      <title>Cat photo</title>
      <wp:post_name>cat-photo</wp:post_name>
      <wp:post_type>attachment</wp:post_type>
      <wp:attachment_url>${OLD_URL}</wp:attachment_url>
    </item>
    <item>
      <title>Post with image</title>
      <wp:post_name>post-with-image</wp:post_name>
      <wp:post_type>post</wp:post_type>
      <wp:status>publish</wp:status>
      <dc:creator>admin</dc:creator>
      <content:encoded><![CDATA[<p>Look: <img src="${OLD_URL}" /></p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

describe("parseWxr attachments", () => {
  it("extracts attachment items separately from content items", () => {
    const parsed = parseWxr(XML);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toMatchObject({ url: OLD_URL, slug: "cat-photo" });
    // The attachment is NOT counted as a content item.
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.slug).toBe("post-with-image");
  });
});

describe("importWxr media re-download + re-link", () => {
  function makeDeps() {
    const created: { content: string }[] = [];
    return {
      created,
      deps: {
        content: {
          getPostBySlug: vi.fn(async () => {
            throw new Error("not found");
          }),
          createPost: vi.fn(async (input: { content: string }) => {
            created.push({ content: input.content });
            return { id: created.length };
          }),
          setPostTerms: vi.fn(async () => {}),
        },
        taxonomy: {
          getTermsWithCounts: vi.fn(async () => []),
          createTerm: vi.fn(async () => ({ id: 1 })),
        },
        comments: { createComment: vi.fn(), approveComment: vi.fn() },
        users: {
          getUserByUsername: vi.fn(async () => {
            throw new Error("no user");
          }),
        },
        media: {
          upload: vi.fn(async () => ({ url: "/uploads/2026/06/cat-abcd1234.jpg" })),
        },
      } as never,
    };
  }

  it("downloads attachments and rewrites their URLs in content", async () => {
    const parsed = parseWxr(XML);
    const { created, deps } = makeDeps();

    const fetchStub: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }));

    const summary = await importWxr(parsed, deps, {
      defaultAuthorId: 1,
      importMedia: true,
      fetch: fetchStub,
    });

    expect(summary.media).toBe(1);
    expect(fetchStub).toHaveBeenCalledWith(OLD_URL);
    expect(created[0]?.content).toContain("/uploads/2026/06/cat-abcd1234.jpg");
    expect(created[0]?.content).not.toContain(OLD_URL);
  });

  it("leaves content untouched when importMedia is off", async () => {
    const parsed = parseWxr(XML);
    const { created, deps } = makeDeps();

    const summary = await importWxr(parsed, deps, { defaultAuthorId: 1 });

    expect(summary.media).toBe(0);
    expect(created[0]?.content).toContain(OLD_URL);
  });
});
