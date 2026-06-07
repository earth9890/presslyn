import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../errors.js";
import { MediaService } from "./media.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => (row: Record<string, unknown>) => row[field] === value,
  and:
    (...predicates: Array<((row: Record<string, unknown>) => boolean) | undefined>) =>
    (row: Record<string, unknown>) =>
      predicates.filter(Boolean).every((predicate) => predicate!(row)),
  like: () => () => true,
  desc: () => "desc",
  asc: () => "asc",
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ strings, values }) as unknown as T,
}));

vi.mock("@presslyn/database", () => ({
  media: {
    id: "id",
    siteId: "siteId",
    uploaderId: "uploaderId",
    filename: "filename",
    mimeType: "mimeType",
    fileSize: "fileSize",
    url: "url",
    alt: "alt",
    title: "title",
    width: "width",
    height: "height",
    meta: "meta",
    createdAt: "createdAt",
  },
  sites: { id: "id", isPrimary: "isPrimary" },
}));

interface MediaRow {
  id: number;
  siteId: number;
  uploaderId: number;
  filename: string;
  mimeType: string;
  fileSize: number;
  url: string;
  alt: string;
  title: string;
  width: number | null;
  height: number | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

function createMockStorage() {
  return {
    save: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn(),
  };
}

function createMockDb(initialRows: MediaRow[]) {
  let rows = initialRows.map((row) => ({ ...row }));

  const buildResult = <T,>(result: T[]) => ({
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(result).then(resolve),
    limit: vi.fn((limit: number) => Promise.resolve(result.slice(0, limit))),
    orderBy: vi.fn(() => ({
      limit: vi.fn((limit: number) => ({
        offset: vi.fn((offset: number) => Promise.resolve(result.slice(offset, offset + limit))),
      })),
    })),
  });

  const mapRow = (shape: Record<string, unknown> | undefined, row: MediaRow) => {
    if (!shape) return { ...row };
    if ("count" in shape) return { count: 1 };
    return Object.fromEntries(Object.keys(shape).map((key) => [key, row[key as keyof MediaRow]]));
  };

  return {
    select: vi.fn((shape?: Record<string, unknown>) => ({
      from: vi.fn(() => ({
        where: vi.fn((predicate?: (row: Record<string, unknown>) => boolean) => {
          const filtered = predicate ? rows.filter(predicate) : rows;
          const mapped = "count" in (shape ?? {}) ? [{ count: filtered.length }] : filtered.map((row) => mapRow(shape, row));
          return buildResult(mapped);
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((updates: Partial<MediaRow>) => ({
        where: vi.fn((predicate: (row: Record<string, unknown>) => boolean) => ({
          returning: vi.fn(async () => {
            const next = rows.map((row) => (predicate(row) ? { ...row, ...updates } : row));
            rows = next;
            return next.filter(predicate).map((row) => ({ ...row }));
          }),
        })),
      })),
    })),
  } as never;
}

describe("MediaService multisite scoping", () => {
  let service: MediaService;

  beforeEach(() => {
    service = new MediaService(
      createMockDb([
        {
          id: 1,
          siteId: 1,
          uploaderId: 1,
          filename: "primary.jpg",
          mimeType: "image/jpeg",
          fileSize: 100,
          url: "/uploads/primary.jpg",
          alt: "",
          title: "Primary image",
          width: 100,
          height: 100,
          meta: {},
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
        },
        {
          id: 2,
          siteId: 2,
          uploaderId: 1,
          filename: "docs.jpg",
          mimeType: "image/jpeg",
          fileSize: 100,
          url: "/uploads/docs.jpg",
          alt: "",
          title: "Docs image",
          width: 100,
          height: 100,
          meta: {},
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ]),
      createMockStorage() as never
    );
  });

  it("returns media only within the requested site", async () => {
    const primary = await service.getById(1, { siteId: 1 });
    expect(primary.title).toBe("Primary image");

    await expect(service.getById(1, { siteId: 2 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("filters media queries by site", async () => {
    const result = await service.query({ orderBy: "date", order: "desc" }, { siteId: 2 });

    expect(result.total).toBe(1);
    expect(result.media).toHaveLength(1);
    expect(result.media[0]?.siteId).toBe(2);
  });

  it("updates media only within the requested site scope", async () => {
    const updated = await service.update(2, { title: "Docs hero" }, { siteId: 2 });
    expect(updated.title).toBe("Docs hero");

    await expect(service.update(2, { title: "Nope" }, { siteId: 1 })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
