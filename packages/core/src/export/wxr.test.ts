import { describe, it, expect } from "vitest";
import { buildWxr, escapeXml, cdata, WXR_VERSION, type WxrData } from "./wxr.js";

const baseData: WxrData = {
  site: {
    title: "Test Site",
    description: "A site",
    link: "https://example.com",
    language: "en-US",
  },
  authors: [
    { id: 1, login: "admin", email: "admin@example.com", displayName: "Admin" },
  ],
  categories: [
    { slug: "news", name: "News" },
    { slug: "sub", name: "Sub", parentSlug: "news" },
  ],
  tags: [{ slug: "tag-a", name: "Tag A" }],
  items: [
    {
      postId: 10,
      title: "Hello",
      link: "https://example.com/hello",
      date: "2026-01-02T03:04:05.000Z",
      authorLogin: "admin",
      content: "<p>Body</p>",
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
          content: "Nice",
          date: "2026-01-03T00:00:00.000Z",
          approved: true,
        },
      ],
    },
  ],
  generatedAt: "2026-06-04T00:00:00.000Z",
};

describe("buildWxr", () => {
  it("produces a well-formed WXR envelope", () => {
    const xml = buildWxr(baseData);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(`<wp:wxr_version>${WXR_VERSION}</wp:wxr_version>`);
    expect(xml).toContain("</rss>");
  });

  it("includes authors, categories, tags, and items", () => {
    const xml = buildWxr(baseData);
    expect(xml).toContain("<wp:author_login><![CDATA[admin]]></wp:author_login>");
    expect(xml).toContain("<wp:cat_name><![CDATA[News]]></wp:cat_name>");
    expect(xml).toContain("<wp:category_parent><![CDATA[news]]></wp:category_parent>");
    expect(xml).toContain("<wp:tag_name><![CDATA[Tag A]]></wp:tag_name>");
    expect(xml).toContain("<wp:post_id>10</wp:post_id>");
    expect(xml).toContain("<content:encoded><![CDATA[<p>Body</p>]]></content:encoded>");
  });

  it("emits comments nested in items", () => {
    const xml = buildWxr(baseData);
    expect(xml).toContain("<wp:comment_id>5</wp:comment_id>");
    expect(xml).toContain("<wp:comment_approved><![CDATA[1]]></wp:comment_approved>");
  });

  it("converts dates to SQL format for post_date", () => {
    const xml = buildWxr(baseData);
    expect(xml).toContain("<wp:post_date><![CDATA[2026-01-02 03:04:05]]></wp:post_date>");
  });

  it("escapes XML metacharacters in attributes and plain elements", () => {
    expect(escapeXml(`a&b<c>"d'e`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;e");
    const data: WxrData = {
      ...baseData,
      items: [
        {
          ...baseData.items[0],
          categories: [{ slug: 'a"b&c', name: "X" }],
        },
      ],
    };
    const xml = buildWxr(data);
    expect(xml).toContain('nicename="a&quot;b&amp;c"');
  });

  it("defuses CDATA-closing sequences in content", () => {
    const out = cdata("danger ]]> here");
    expect(out).toBe("<![CDATA[danger ]]]]><![CDATA[> here]]>");
    // No raw "]]>" remains other than the legitimate CDATA terminators.
    const data: WxrData = {
      ...baseData,
      items: [{ ...baseData.items[0], content: "x ]]> y" }],
    };
    const xml = buildWxr(data);
    expect(xml).toContain("<![CDATA[x ]]]]><![CDATA[> y]]>");
  });
});
