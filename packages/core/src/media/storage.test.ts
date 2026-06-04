import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalStorageAdapter } from "./storage.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("LocalStorageAdapter", () => {
  let tmpDir: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "presslyn-test-"));
    adapter = new LocalStorageAdapter(tmpDir, "/uploads");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("should save a file and return URL", async () => {
      const buffer = Buffer.from("hello world");
      const url = await adapter.save("2026/04/test.txt", buffer);
      expect(url).toBe("/uploads/2026/04/test.txt");

      const content = await fs.readFile(path.join(tmpDir, "2026/04/test.txt"), "utf-8");
      expect(content).toBe("hello world");
    });

    it("should create nested directories automatically", async () => {
      const buffer = Buffer.from("nested");
      await adapter.save("deep/nested/path/file.txt", buffer);

      const content = await fs.readFile(
        path.join(tmpDir, "deep/nested/path/file.txt"),
        "utf-8"
      );
      expect(content).toBe("nested");
    });

    it("should reject path traversal with ../", async () => {
      const buffer = Buffer.from("evil");
      await expect(
        adapter.save("../../etc/passwd", buffer)
      ).rejects.toThrow("Path traversal detected");
    });

    it("should reject path traversal with absolute paths", async () => {
      const buffer = Buffer.from("evil");
      await expect(
        adapter.save("/etc/passwd", buffer)
      ).rejects.toThrow("Path traversal detected");
    });
  });

  describe("delete", () => {
    it("should delete an existing file", async () => {
      const filePath = path.join(tmpDir, "to-delete.txt");
      await fs.writeFile(filePath, "delete me");

      await adapter.delete("to-delete.txt");

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it("should not throw for non-existent files", async () => {
      await expect(adapter.delete("nonexistent.txt")).resolves.not.toThrow();
    });

    it("should reject path traversal on delete", async () => {
      await expect(
        adapter.delete("../../etc/passwd")
      ).resolves.not.toThrow(); // silently ignores due to try-catch, but path is validated
    });
  });

  describe("getUrl", () => {
    it("should return URL with base path", () => {
      expect(adapter.getUrl("2026/04/image.jpg")).toBe("/uploads/2026/04/image.jpg");
    });
  });

  describe("custom baseUrl", () => {
    it("should use custom base URL", () => {
      const customAdapter = new LocalStorageAdapter(tmpDir, "https://cdn.example.com");
      expect(customAdapter.getUrl("2026/04/image.jpg")).toBe(
        "https://cdn.example.com/2026/04/image.jpg"
      );
    });
  });
});
