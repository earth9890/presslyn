import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { MediaService } from "./media.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => ({ field, value }),
  and: (...preds: unknown[]) => ({ and: preds }),
  or: (...preds: unknown[]) => ({ or: preds }),
  gte: () => ({}),
  lt: () => ({}),
  like: () => ({}),
  desc: () => "desc",
  asc: () => "asc",
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ strings, values }) as unknown as T,
}));

vi.mock("@presslyn/database", () => ({
  media: { id: "id", siteId: "siteId", mimeType: "mimeType", createdAt: "createdAt" },
  sites: { id: "id" },
}));

function createMockStorage(seed: Record<string, Buffer>) {
  const files = new Map<string, Buffer>(Object.entries(seed));
  return {
    files,
    save: vi.fn(async (filepath: string, buffer: Buffer) => {
      files.set(filepath, buffer);
      return `/uploads/${filepath}`;
    }),
    read: vi.fn(async (filepath: string) => {
      const b = files.get(filepath);
      if (!b) throw new Error(`ENOENT ${filepath}`);
      return b;
    }),
    delete: vi.fn(async (filepath: string) => {
      files.delete(filepath);
    }),
    getUrl: vi.fn((filepath: string) => `/uploads/${filepath}`),
  };
}

function createMockDb(record: Record<string, unknown>) {
  let current = { ...record };
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [current]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((value: Record<string, unknown>) => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              current = { ...current, ...value };
              return [current];
            }),
          })),
        })),
      })),
    } as never,
    getCurrent: () => current,
  };
}

describe("MediaService.editImage", () => {
  let original: Buffer;

  beforeEach(async () => {
    // A 100x60 red PNG.
    original = await sharp({
      create: { width: 100, height: 60, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
  });

  function makeService(storage: ReturnType<typeof createMockStorage>) {
    const mock = createMockDb({
      id: 1,
      siteId: 1,
      mimeType: "image/png",
      width: 100,
      height: 60,
      fileSize: original.length,
      meta: { filepath: "2026/06/red.png", thumbnails: {} },
      createdAt: new Date(),
    });
    // Force legacy single-site mode so scope resolution doesn't hit `sites`.
    const service = new MediaService(mock.db, storage as never);
    (service as unknown as { legacySingleSiteMode: boolean }).legacySingleSiteMode = true;
    return { service, getCurrent: mock.getCurrent };
  }

  it("rotates 90° and swaps the stored dimensions", async () => {
    const storage = createMockStorage({ "2026/06/red.png": original });
    const { service } = makeService(storage);

    const updated = await service.editImage(1, { rotate: 90 });
    expect(updated.width).toBe(60);
    expect(updated.height).toBe(100);

    // The original file was overwritten in place.
    const saved = storage.files.get("2026/06/red.png")!;
    const meta = await sharp(saved).metadata();
    expect(meta.width).toBe(60);
    expect(meta.height).toBe(100);
  });

  it("crops to an absolute rectangle", async () => {
    const storage = createMockStorage({ "2026/06/red.png": original });
    const { service } = makeService(storage);

    const updated = await service.editImage(1, {
      crop: { left: 10, top: 10, width: 40, height: 30 },
    });
    expect(updated.width).toBe(40);
    expect(updated.height).toBe(30);
  });

  it("rejects a crop rectangle out of bounds", async () => {
    const storage = createMockStorage({ "2026/06/red.png": original });
    const { service } = makeService(storage);

    await expect(
      service.editImage(1, { crop: { left: 0, top: 0, width: 999, height: 999 } })
    ).rejects.toThrow(/out of bounds/i);
  });

  it("rejects when no edits are requested", async () => {
    const storage = createMockStorage({ "2026/06/red.png": original });
    const { service } = makeService(storage);
    await expect(service.editImage(1, {})).rejects.toThrow(/no image edits/i);
  });
});
