import { describe, it, expect } from "vitest";
import {
  DEFAULT_ROLES,
  getRole,
  getAllRoles,
  registerRole,
  userCan,
} from "./roles.js";

describe("DEFAULT_ROLES", () => {
  it("should have 5 built-in roles", () => {
    const roleNames = Object.keys(DEFAULT_ROLES);
    expect(roleNames).toEqual([
      "administrator",
      "editor",
      "author",
      "contributor",
      "subscriber",
    ]);
  });

  it("administrator should have manage_options capability", () => {
    expect(DEFAULT_ROLES.administrator.capabilities.has("manage_options")).toBe(true);
  });

  it("subscriber should only have read capability", () => {
    const caps = DEFAULT_ROLES.subscriber.capabilities;
    expect(caps.size).toBe(1);
    expect(caps.has("read")).toBe(true);
  });

  it("editor should not have manage_options", () => {
    expect(DEFAULT_ROLES.editor.capabilities.has("manage_options")).toBe(false);
  });

  it("author should have upload_files but not edit_others_posts", () => {
    expect(DEFAULT_ROLES.author.capabilities.has("upload_files")).toBe(true);
    expect(DEFAULT_ROLES.author.capabilities.has("edit_others_posts")).toBe(false);
  });

  it("contributor should have edit_posts but not publish_posts", () => {
    expect(DEFAULT_ROLES.contributor.capabilities.has("edit_posts")).toBe(true);
    expect(DEFAULT_ROLES.contributor.capabilities.has("publish_posts")).toBe(false);
  });
});

describe("getRole", () => {
  it("should return a built-in role", () => {
    const role = getRole("administrator");
    expect(role).toBeDefined();
    expect(role!.displayName).toBe("Administrator");
  });

  it("should return undefined for non-existent role", () => {
    expect(getRole("nonexistent")).toBeUndefined();
  });
});

describe("getAllRoles", () => {
  it("should return at least the 5 built-in roles", () => {
    const roles = getAllRoles();
    expect(roles.length).toBeGreaterThanOrEqual(5);
    const names = roles.map((r) => r.name);
    expect(names).toContain("administrator");
    expect(names).toContain("subscriber");
  });
});

describe("registerRole", () => {
  it("should add a custom role", () => {
    registerRole("seo_manager", "SEO Manager", ["edit_posts", "manage_categories"]);
    const role = getRole("seo_manager");
    expect(role).toBeDefined();
    expect(role!.displayName).toBe("SEO Manager");
    expect(role!.capabilities.has("edit_posts")).toBe(true);
    expect(role!.capabilities.has("manage_categories")).toBe(true);
  });

  it("custom role should appear in getAllRoles", () => {
    const roles = getAllRoles();
    const names = roles.map((r) => r.name);
    expect(names).toContain("seo_manager");
  });
});

describe("userCan", () => {
  it("should return true for a capability the role has", () => {
    expect(userCan("administrator", "manage_options")).toBe(true);
  });

  it("should return false for a capability the role lacks", () => {
    expect(userCan("subscriber", "edit_posts")).toBe(false);
  });

  it("should return false for non-existent role", () => {
    expect(userCan("nonexistent_role", "read")).toBe(false);
  });

  it("should return false for non-existent capability", () => {
    expect(userCan("administrator", "fly_to_moon")).toBe(false);
  });

  it("should work with custom roles", () => {
    expect(userCan("seo_manager", "edit_posts")).toBe(true);
    expect(userCan("seo_manager", "manage_options")).toBe(false);
  });
});
