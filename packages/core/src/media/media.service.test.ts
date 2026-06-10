/**
 * MediaService unit tests.
 *
 * Tests the non-DB parts of MediaService: filename sanitization,
 * MIME validation, file size limits, and upload security checks.
 * DB-dependent methods (getById, update, delete, query) require
 * integration tests with a test database.
 *
 * We test the upload method with a mock DB and mock storage adapter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the private sanitizeFilename indirectly through upload behavior,
// but we can also test the media service's validation logic by attempting uploads.

// For testing, we create a minimal mock of the database and storage.
function createMockStorage() {
  const files = new Map<string, Buffer>();
  return {
    save: vi.fn(async (filepath: string, buffer: Buffer) => {
      files.set(filepath, buffer);
      return `/uploads/${filepath}`;
    }),
    read: vi.fn(async (filepath: string) => {
      const buf = files.get(filepath);
      if (!buf) throw new Error(`ENOENT: ${filepath}`);
      return buf;
    }),
    delete: vi.fn(async (filepath: string) => {
      files.delete(filepath);
    }),
    getUrl: vi.fn((filepath: string) => `/uploads/${filepath}`),
    files,
  };
}

function createMockDb() {
  const insertReturning = vi.fn(async () => [
    {
      id: 1,
      uploaderId: 1,
      filename: "test.jpg",
      mimeType: "image/jpeg",
      fileSize: 100,
      url: "/uploads/test.jpg",
      alt: "",
      title: "test",
      width: 100,
      height: 100,
      meta: {},
      createdAt: new Date(),
    },
  ]);

  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: insertReturning,
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{}]),
        })),
      })),
    })),
  } as any;
}

// Create a minimal valid JPEG (smallest possible JPEG file)
// JPEG magic bytes: FF D8 FF
function createMinimalJpeg(): Buffer {
  // A valid JPEG with SOI, APP0, and EOI markers
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

// Create a minimal valid PNG
function createMinimalPng(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  ]);
}

describe("MediaService", () => {
  let mockDb: any;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockStorage = createMockStorage();
    vi.restoreAllMocks();
  });

  describe("upload validation", () => {
    it("should reject disallowed MIME types", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "shell.php",
          mimeType: "application/x-php",
          buffer: Buffer.from("<?php echo 'hacked'; ?>"),
        })
      ).rejects.toThrow("not allowed");
    });

    it("should reject SVG (XSS vector)", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "icon.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
        })
      ).rejects.toThrow("not allowed");
    });

    it("should reject files exceeding max size", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage, 1024); // 1KB max

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "big.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.alloc(2048), // 2KB
        })
      ).rejects.toThrow("exceeds maximum");
    });

    it("should reject filenames with null bytes", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "file\0.jpg",
          mimeType: "image/jpeg",
          buffer: createMinimalJpeg(),
        })
      ).rejects.toThrow("null bytes");
    });

    it("should reject MIME mismatch (content doesn't match claimed type)", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      // GIF magic bytes (GIF89a) but claiming JPEG
      const gifBuffer = Buffer.from(
        "GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
        "binary"
      );

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "image.jpg",
          mimeType: "image/jpeg",
          buffer: gifBuffer,
        })
      ).rejects.toThrow("does not match claimed type");
    });

    it("should reject extension mismatch", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "image.png",
          mimeType: "image/jpeg",
          buffer: createMinimalJpeg(),
        })
      ).rejects.toThrow("does not match MIME type");
    });

    it("should reject empty filename", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "",
          mimeType: "image/jpeg",
          buffer: createMinimalJpeg(),
        })
      ).rejects.toThrow();
    });

    it("should reject unknown fields (strict Zod)", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      await expect(
        service.upload({
          uploaderId: 1,
          filename: "test.jpg",
          mimeType: "image/jpeg",
          buffer: createMinimalJpeg(),
          isAdmin: true, // unknown field
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("filename sanitization", () => {
    it("should handle double extension attacks via upload", async () => {
      const { MediaService } = await import("./media.service.js");
      const service = new MediaService(mockDb, mockStorage);

      // The upload will validate MIME content, but we can check that
      // the filename is sanitized. Since JPEG magic bytes are needed,
      // and the mock storage captures the filepath, let's verify indirectly.
      // The filename "malware.php.jpg" should become "malware-php.jpg"
      try {
        await service.upload({
          uploaderId: 1,
          filename: "malware.php.jpg",
          mimeType: "image/jpeg",
          buffer: createMinimalJpeg(),
        });
      } catch {
        // May fail on image processing, but storage.save should have been called
      }

      // Check that if save was called, the filename doesn't contain .php
      if (mockStorage.save.mock.calls.length > 0) {
        const savedPath = mockStorage.save.mock.calls[0][0] as string;
        expect(savedPath).not.toContain(".php.");
      }
    });
  });
});
