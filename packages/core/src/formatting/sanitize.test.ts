import { describe, it, expect } from "vitest";
import {
  escHtml,
  escAttr,
  escUrl,
  sanitizeTitle,
  sanitizeEmail,
  sanitizeFileName,
  autop,
  stripTags,
  truncateWords,
} from "./sanitize.js";

// ─── escHtml ─────────────────────────────────────────────────

describe("escHtml", () => {
  it("escapes ampersand", () => {
    expect(escHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes less-than", () => {
    expect(escHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than", () => {
    expect(escHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escHtml("it's")).toBe("it&#039;s");
  });

  it("escapes all five special characters together", () => {
    expect(escHtml(`<div class="a" data-x='b'>&</div>`)).toBe(
      "&lt;div class=&quot;a&quot; data-x=&#039;b&#039;&gt;&amp;&lt;/div&gt;"
    );
  });

  it("returns empty string unchanged", () => {
    expect(escHtml("")).toBe("");
  });

  it("double-escapes already-escaped input", () => {
    expect(escHtml("&amp;")).toBe("&amp;amp;");
    expect(escHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text unchanged", () => {
    expect(escHtml("hello world")).toBe("hello world");
  });
});

// ─── escAttr ─────────────────────────────────────────────────

describe("escAttr", () => {
  it("escapes ampersand", () => {
    expect(escAttr("a&b")).toBe("a&amp;b");
  });

  it("escapes less-than", () => {
    expect(escAttr("a<b")).toBe("a&lt;b");
  });

  it("escapes greater-than", () => {
    expect(escAttr("a>b")).toBe("a&gt;b");
  });

  it("escapes double quotes", () => {
    expect(escAttr('a"b')).toBe("a&quot;b");
  });

  it("escapes single quotes", () => {
    expect(escAttr("a'b")).toBe("a&#039;b");
  });

  it("returns empty string unchanged", () => {
    expect(escAttr("")).toBe("");
  });

  it("double-escapes already-escaped input", () => {
    expect(escAttr("&amp;")).toBe("&amp;amp;");
  });
});

// ─── escUrl ──────────────────────────────────────────────────

describe("escUrl", () => {
  it("allows http URLs", () => {
    expect(escUrl("http://example.com")).toBe("http://example.com/");
  });

  it("allows https URLs", () => {
    expect(escUrl("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1"
    );
  });

  it("allows mailto URLs", () => {
    expect(escUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("allows tel URLs", () => {
    expect(escUrl("tel:+1234567890")).toBe("tel:+1234567890");
  });

  it("rejects javascript: protocol", () => {
    expect(escUrl("javascript:alert(1)")).toBe("");
  });

  it("rejects data: protocol", () => {
    expect(escUrl("data:text/html,<h1>Hi</h1>")).toBe("");
  });

  it("returns empty for relative URL (not parseable by URL constructor)", () => {
    expect(escUrl("/relative/path")).toBe("");
  });

  it("returns empty for malformed URL", () => {
    expect(escUrl("not a url at all")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(escUrl("")).toBe("");
  });
});

// ─── sanitizeTitle ───────────────────────────────────────────

describe("sanitizeTitle", () => {
  it("converts a basic title to a slug", () => {
    expect(sanitizeTitle("Hello World")).toBe("hello-world");
  });

  it("removes diacritics", () => {
    expect(sanitizeTitle("café")).toBe("cafe");
    expect(sanitizeTitle("über cool")).toBe("uber-cool");
    expect(sanitizeTitle("résumé")).toBe("resume");
  });

  it("removes special characters", () => {
    expect(sanitizeTitle("Hello, World! @2024")).toBe("hello-world-2024");
  });

  it("converts spaces to hyphens", () => {
    expect(sanitizeTitle("one two three")).toBe("one-two-three");
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeTitle("hello---world")).toBe("hello-world");
    expect(sanitizeTitle("a   b   c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(sanitizeTitle(" hello world ")).toBe("hello-world");
    expect(sanitizeTitle("--hello--")).toBe("hello");
  });

  it("truncates to 200 characters", () => {
    const long = "a".repeat(300);
    expect(sanitizeTitle(long).length).toBeLessThanOrEqual(200);
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeTitle("")).toBe("");
  });

  it("returns empty string for input with only special chars", () => {
    expect(sanitizeTitle("!@#$%^&*()")).toBe("");
  });
});

// ─── sanitizeEmail ───────────────────────────────────────────

describe("sanitizeEmail", () => {
  it("accepts a valid email", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
  });

  it("normalizes uppercase to lowercase", () => {
    expect(sanitizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("returns empty for email missing @", () => {
    expect(sanitizeEmail("userexample.com")).toBe("");
  });

  it("returns empty for email missing TLD", () => {
    expect(sanitizeEmail("user@example")).toBe("");
  });

  it("returns empty for email with spaces in it", () => {
    expect(sanitizeEmail("user @example.com")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(sanitizeEmail("")).toBe("");
  });

  it("accepts email with plus addressing", () => {
    expect(sanitizeEmail("user+tag@example.com")).toBe("user+tag@example.com");
  });

  it("accepts email with dots in local part", () => {
    expect(sanitizeEmail("first.last@example.com")).toBe(
      "first.last@example.com"
    );
  });
});

// ─── sanitizeFileName ────────────────────────────────────────

describe("sanitizeFileName", () => {
  it("keeps a valid filename unchanged", () => {
    expect(sanitizeFileName("report.pdf")).toBe("report.pdf");
  });

  it("replaces special characters with hyphens", () => {
    // spaces and parens become hyphens, then consecutive hyphens collapse
    expect(sanitizeFileName("my file (1).pdf")).toBe("my-file-1-.pdf");
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeFileName("a@@@b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    // consecutive hyphens collapse first, then leading/trailing hyphens trimmed
    expect(sanitizeFileName("--hello--.txt")).toBe("hello-.txt");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeFileName("")).toBe("");
  });

  it("preserves dots, underscores, and hyphens", () => {
    expect(sanitizeFileName("my_file-name.v2.tar.gz")).toBe(
      "my_file-name.v2.tar.gz"
    );
  });
});

// ─── autop ───────────────────────────────────────────────────

describe("autop", () => {
  it("wraps a single paragraph in <p> tags", () => {
    expect(autop("Hello world")).toBe("<p>Hello world</p>");
  });

  it("splits double newlines into separate paragraphs", () => {
    expect(autop("First paragraph.\n\nSecond paragraph.")).toBe(
      "<p>First paragraph.</p>\n\n<p>Second paragraph.</p>"
    );
  });

  it("converts single newlines to <br>", () => {
    expect(autop("Line one\nLine two")).toBe(
      "<p>Line one<br>\nLine two</p>"
    );
  });

  it("returns empty string for empty input", () => {
    expect(autop("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(autop("   \n\n  ")).toBe("");
  });

  it("handles mixed single and double newlines", () => {
    const input = "Para one line one\nPara one line two\n\nPara two";
    const expected =
      "<p>Para one line one<br>\nPara one line two</p>\n\n<p>Para two</p>";
    expect(autop(input)).toBe(expected);
  });

  it("handles carriage return line endings", () => {
    expect(autop("First\r\n\r\nSecond")).toBe(
      "<p>First</p>\n\n<p>Second</p>"
    );
  });
});

// ─── stripTags ───────────────────────────────────────────────

describe("stripTags", () => {
  it("strips basic HTML tags", () => {
    expect(stripTags("<p>Hello</p>")).toBe("Hello");
  });

  it("strips nested tags", () => {
    expect(stripTags("<div><span>Nested</span></div>")).toBe("Nested");
  });

  it("returns empty string for empty input", () => {
    expect(stripTags("")).toBe("");
  });

  it("returns text unchanged when no tags present", () => {
    expect(stripTags("plain text")).toBe("plain text");
  });

  it("strips self-closing tags", () => {
    expect(stripTags("before<br/>after")).toBe("beforeafter");
    expect(stripTags("before<img src='x' />after")).toBe("beforeafter");
  });

  it("strips tags with attributes", () => {
    expect(stripTags('<a href="https://example.com">Link</a>')).toBe("Link");
  });
});

// ─── truncateWords ───────────────────────────────────────────

describe("truncateWords", () => {
  it("truncates text exceeding the word limit", () => {
    const text = "one two three four five six seven";
    expect(truncateWords(text, 3)).toBe("one two three...");
  });

  it("returns full text when fewer words than limit", () => {
    expect(truncateWords("hello world", 10)).toBe("hello world");
  });

  it("returns full text when exactly at the word limit", () => {
    expect(truncateWords("one two three", 3)).toBe("one two three");
  });

  it("uses custom more string", () => {
    expect(truncateWords("one two three four", 2, " [read more]")).toBe(
      "one two [read more]"
    );
  });

  it("returns empty string for empty input", () => {
    expect(truncateWords("", 5)).toBe("");
  });

  it("uses default word count of 55", () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
    const result = truncateWords(words);
    // Should contain exactly 55 words + "..."
    expect(result.endsWith("...")).toBe(true);
    expect(result.replace("...", "").trim().split(/\s+/).length).toBe(55);
  });
});
