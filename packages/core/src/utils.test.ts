import { describe, it, expect } from "vitest";
import { escapeLike, generateSlug } from "./utils.js";

describe("escapeLike", () => {
  it("should escape % character", () => {
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("should escape _ character", () => {
    expect(escapeLike("user_name")).toBe("user\\_name");
  });

  it("should escape \\ character", () => {
    expect(escapeLike("path\\to")).toBe("path\\\\to");
  });

  it("should escape multiple special characters", () => {
    expect(escapeLike("%_\\")).toBe("\\%\\_\\\\");
  });

  it("should not modify strings without special characters", () => {
    expect(escapeLike("hello world")).toBe("hello world");
  });

  it("should handle empty string", () => {
    expect(escapeLike("")).toBe("");
  });
});

describe("generateSlug", () => {
  it("should generate a basic slug from a title", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("should handle multiple spaces", () => {
    expect(generateSlug("Hello   World")).toBe("hello-world");
  });

  it("should remove special characters", () => {
    expect(generateSlug("Hello, World! (2024)")).toBe("hello-world-2024");
  });

  it("should handle diacritics via NFD normalization", () => {
    expect(generateSlug("Café Résumé")).toBe("cafe-resume");
  });

  it("should collapse consecutive hyphens", () => {
    expect(generateSlug("hello---world")).toBe("hello-world");
  });

  it("should remove leading and trailing hyphens", () => {
    expect(generateSlug("-hello-world-")).toBe("hello-world");
  });

  it("should truncate to 200 characters", () => {
    const longTitle = "a ".repeat(150); // 300 chars
    const slug = generateSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(200);
  });

  it("should return a fallback for non-Latin titles", () => {
    const slug = generateSlug("日本語タイトル");
    expect(slug).toBeTruthy();
    expect(slug.length).toBeGreaterThan(0);
    // Fallback format: "post-" followed by base36 timestamp
    expect(slug).toMatch(/^post-/);
  });

  it("should return a fallback for empty string", () => {
    const slug = generateSlug("");
    expect(slug).toBeTruthy();
    expect(slug).toMatch(/^post-/);
  });

  it("should handle numbers", () => {
    expect(generateSlug("2024 Best Of")).toBe("2024-best-of");
  });
});
