import { describe, it, expect } from "vitest";
import {
  getPostType,
  getAllPostTypes,
  getPublicPostTypes,
  registerPostType,
} from "./post-types.js";

describe("Built-in post types", () => {
  it("should have 'post' registered", () => {
    const pt = getPostType("post");
    expect(pt).toBeDefined();
    expect(pt!.label).toBe("Post");
    expect(pt!.public).toBe(true);
    expect(pt!.hierarchical).toBe(false);
  });

  it("should have 'page' registered", () => {
    const pt = getPostType("page");
    expect(pt).toBeDefined();
    expect(pt!.label).toBe("Page");
    expect(pt!.public).toBe(true);
    expect(pt!.hierarchical).toBe(true);
  });

  it("should have 'attachment' registered", () => {
    const pt = getPostType("attachment");
    expect(pt).toBeDefined();
    expect(pt!.public).toBe(false);
  });

  it("should return undefined for non-existent type", () => {
    expect(getPostType("nonexistent")).toBeUndefined();
  });
});

describe("getAllPostTypes", () => {
  it("should return at least the 3 built-in types", () => {
    const types = getAllPostTypes();
    expect(types.length).toBeGreaterThanOrEqual(3);
    const names = types.map((t) => t.name);
    expect(names).toContain("post");
    expect(names).toContain("page");
    expect(names).toContain("attachment");
  });
});

describe("getPublicPostTypes", () => {
  it("should return only public types", () => {
    const types = getPublicPostTypes();
    for (const t of types) {
      expect(t.public).toBe(true);
    }
  });

  it("should include post and page but not attachment", () => {
    const names = getPublicPostTypes().map((t) => t.name);
    expect(names).toContain("post");
    expect(names).toContain("page");
    expect(names).not.toContain("attachment");
  });
});

describe("registerPostType", () => {
  it("should register a custom post type", () => {
    registerPostType("product", {
      label: "Product",
      labelPlural: "Products",
      description: "E-commerce products",
      public: true,
      hierarchical: false,
      hasArchive: true,
      showInMenu: true,
      showInRest: true,
      menuPosition: 26,
      supports: new Set(["title", "editor", "thumbnail"]),
    });

    const pt = getPostType("product");
    expect(pt).toBeDefined();
    expect(pt!.label).toBe("Product");
    expect(pt!.supports.has("title")).toBe(true);
    expect(pt!.supports.has("editor")).toBe(true);
  });

  it("custom type should appear in getAllPostTypes", () => {
    const names = getAllPostTypes().map((t) => t.name);
    expect(names).toContain("product");
  });

  it("public custom type should appear in getPublicPostTypes", () => {
    const names = getPublicPostTypes().map((t) => t.name);
    expect(names).toContain("product");
  });
});

describe("post type supports", () => {
  it("post should support title, editor, author, thumbnail, excerpt, comments, revisions", () => {
    const pt = getPostType("post")!;
    expect(pt.supports.has("title")).toBe(true);
    expect(pt.supports.has("editor")).toBe(true);
    expect(pt.supports.has("author")).toBe(true);
    expect(pt.supports.has("thumbnail")).toBe(true);
    expect(pt.supports.has("excerpt")).toBe(true);
    expect(pt.supports.has("comments")).toBe(true);
    expect(pt.supports.has("revisions")).toBe(true);
  });

  it("page should support page-attributes but not post-formats", () => {
    const pt = getPostType("page")!;
    expect(pt.supports.has("page-attributes")).toBe(true);
    expect(pt.supports.has("post-formats")).toBe(false);
  });
});
