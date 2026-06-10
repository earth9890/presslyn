import { describe, it, expect } from "vitest";
import {
  normalizeSitePath,
  isPathUnderSite,
  stripSitePath,
  matchSiteBasePath,
} from "./path.js";

describe("normalizeSitePath", () => {
  it("normalizes empty/root", () => {
    expect(normalizeSitePath("")).toBe("/");
    expect(normalizeSitePath("/")).toBe("/");
    expect(normalizeSitePath(undefined)).toBe("/");
  });
  it("adds leading and trailing slashes", () => {
    expect(normalizeSitePath("blog")).toBe("/blog/");
    expect(normalizeSitePath("/blog")).toBe("/blog/");
    expect(normalizeSitePath("/blog/")).toBe("/blog/");
  });
});

describe("isPathUnderSite", () => {
  it("root site matches everything", () => {
    expect(isPathUnderSite("/", "/anything")).toBe(true);
  });
  it("matches the base and descendants", () => {
    expect(isPathUnderSite("/blog", "/blog")).toBe(true);
    expect(isPathUnderSite("/blog", "/blog/hello")).toBe(true);
  });
  it("does not match a sibling sharing the prefix", () => {
    expect(isPathUnderSite("/blog", "/blogging")).toBe(false);
    expect(isPathUnderSite("/blog", "/other")).toBe(false);
  });
});

describe("stripSitePath", () => {
  it("strips the base path", () => {
    expect(stripSitePath("/blog/hello", "/blog")).toBe("/hello");
    expect(stripSitePath("/blog/category/news", "/blog")).toBe("/category/news");
  });
  it("maps the bare base to root", () => {
    expect(stripSitePath("/blog", "/blog")).toBe("/");
    expect(stripSitePath("/blog/", "/blog")).toBe("/");
  });
  it("leaves non-matching paths unchanged", () => {
    expect(stripSitePath("/other", "/blog")).toBe("/other");
    expect(stripSitePath("/blogging", "/blog")).toBe("/blogging");
  });
  it("is a no-op for a root site", () => {
    expect(stripSitePath("/hello", "/")).toBe("/hello");
  });
});

describe("matchSiteBasePath", () => {
  it("returns the longest matching base", () => {
    expect(matchSiteBasePath("/blog/news/post", ["/blog", "/blog/news"])).toBe(
      "/blog/news/"
    );
  });
  it("returns null when nothing matches", () => {
    expect(matchSiteBasePath("/shop", ["/blog"])).toBeNull();
  });
  it("ignores root base paths", () => {
    expect(matchSiteBasePath("/anything", ["/"])).toBeNull();
  });
});
