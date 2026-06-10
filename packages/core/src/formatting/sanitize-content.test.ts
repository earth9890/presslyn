import { describe, it, expect } from "vitest";
import { sanitizeContentHtml } from "./sanitize.js";

describe("sanitizeContentHtml", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeContentHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<p>hi</p>");
  });

  it("removes event-handler attributes", () => {
    const out = sanitizeContentHtml('<img src="x" onerror="alert(1)" alt="a" />');
    expect(out).not.toContain("onerror");
    expect(out).toContain("alt=\"a\"");
  });

  it("drops javascript: URLs on links", () => {
    const out = sanitizeContentHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips <iframe> and <style>", () => {
    const out = sanitizeContentHtml(
      '<iframe src="https://evil.test"></iframe><style>body{display:none}</style><p>ok</p>'
    );
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<style");
    expect(out).toContain("<p>ok</p>");
  });

  it("preserves allowed formatting from the block editor", () => {
    const input =
      '<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p>' +
      '<ul><li>one</li></ul><blockquote>q</blockquote>' +
      '<a href="https://example.com" title="t">link</a>' +
      '<img src="https://example.com/a.jpg" alt="a" width="100" height="50" />';
    const out = sanitizeContentHtml(input);
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<ul><li>one</li></ul>");
    expect(out).toContain("<blockquote>q</blockquote>");
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('src="https://example.com/a.jpg"');
  });

  it("adds rel=noopener for target=_blank links", () => {
    const out = sanitizeContentHtml('<a href="https://x.test" target="_blank">x</a>');
    expect(out).toContain("noopener");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeContentHtml("")).toBe("");
  });
});
