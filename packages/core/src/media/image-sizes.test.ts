import { describe, it, expect } from "vitest";
import {
  getImageSize,
  getAllImageSizes,
  registerImageSize,
} from "./image-sizes.js";

describe("Built-in image sizes", () => {
  it("should have thumbnail (150x150 crop)", () => {
    const size = getImageSize("thumbnail");
    expect(size).toBeDefined();
    expect(size!.width).toBe(150);
    expect(size!.height).toBe(150);
    expect(size!.crop).toBe(true);
  });

  it("should have medium (300x300 no crop)", () => {
    const size = getImageSize("medium");
    expect(size).toBeDefined();
    expect(size!.width).toBe(300);
    expect(size!.height).toBe(300);
    expect(size!.crop).toBe(false);
  });

  it("should have medium_large (768x0 no crop)", () => {
    const size = getImageSize("medium_large");
    expect(size).toBeDefined();
    expect(size!.width).toBe(768);
    expect(size!.height).toBe(0);
  });

  it("should have large (1024x1024 no crop)", () => {
    const size = getImageSize("large");
    expect(size).toBeDefined();
    expect(size!.width).toBe(1024);
    expect(size!.height).toBe(1024);
    expect(size!.crop).toBe(false);
  });

  it("should return undefined for non-existent size", () => {
    expect(getImageSize("nonexistent")).toBeUndefined();
  });
});

describe("getAllImageSizes", () => {
  it("should return at least the 4 built-in sizes", () => {
    const sizes = getAllImageSizes();
    expect(sizes.length).toBeGreaterThanOrEqual(4);
    const names = sizes.map((s) => s.name);
    expect(names).toContain("thumbnail");
    expect(names).toContain("medium");
    expect(names).toContain("large");
  });
});

describe("registerImageSize", () => {
  it("should register a custom image size", () => {
    registerImageSize("hero", 1920, 600, true);
    const size = getImageSize("hero");
    expect(size).toBeDefined();
    expect(size!.width).toBe(1920);
    expect(size!.height).toBe(600);
    expect(size!.crop).toBe(true);
  });

  it("custom size should appear in getAllImageSizes", () => {
    const names = getAllImageSizes().map((s) => s.name);
    expect(names).toContain("hero");
  });
});
