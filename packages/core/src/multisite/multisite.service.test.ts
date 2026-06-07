import { beforeEach, describe, expect, it, vi } from "vitest";
import { MultisiteService } from "./multisite.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => (row: Record<string, unknown>) => row[field] === value,
  and:
    (...predicates: Array<(row: Record<string, unknown>) => boolean>) =>
    (row: Record<string, unknown>) =>
      predicates.every((predicate) => predicate(row)),
  asc: (field: string) => field,
}));

vi.mock("@presslyn/database", () => ({
  sites: {
    id: "id",
    name: "name",
    domain: "domain",
    path: "path",
    status: "status",
    isPrimary: "isPrimary",
    meta: "meta",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

interface SiteRow {
  id: number;
  name: string;
  domain: string;
  path: string;
  status: "active" | "archived" | "deleted";
  isPrimary: boolean;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

function createMockDb(initialSites: SiteRow[]) {
  let rows = initialSites.map((site) => ({ ...site }));

  const queryResult = <T,>(result: T[]) => ({
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(result).then(resolve),
    limit: vi.fn(async (limit: number) => result.slice(0, limit)),
  });

  const buildSelect = (shape?: Record<string, unknown>) => ({
    from: vi.fn(() => ({
      orderBy: vi.fn(async (field: keyof SiteRow) =>
        rows
          .slice()
          .sort((a, b) => compareAscending(a[field], b[field]))
          .map((row) => (shape ? projectRow(row, shape) : { ...row }))
      ),
      where: vi.fn((predicate: (row: SiteRow) => boolean) =>
        queryResult(
          rows
            .filter(predicate)
            .map((row) => (shape ? projectRow(row, shape) : { ...row }))
        )
      ),
    })),
  });

  return {
    select: vi.fn((shape?: Record<string, unknown>) => buildSelect(shape)),
    insert: vi.fn(() => ({
      values: vi.fn((value: Omit<SiteRow, "id" | "createdAt" | "updatedAt">) => ({
        returning: vi.fn(async () => {
          const created: SiteRow = {
            id: rows.length + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...value,
          };
          rows.push(created);
          return [{ ...created }];
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Partial<SiteRow>) => ({
        where: vi.fn((predicate: (row: SiteRow) => boolean) => ({
          returning: vi.fn(async () => {
            const index = rows.findIndex(predicate);
            if (index === -1) return [];
            rows[index] = { ...rows[index], ...value };
            return [{ ...rows[index] }];
          }),
        })),
      })),
    })),
    snapshot: () => rows.map((row) => ({ ...row })),
  };
}

function projectRow(row: SiteRow, shape: Record<string, unknown>) {
  return Object.fromEntries(
    Object.keys(shape).map((key) => [key, row[key as keyof SiteRow]])
  );
}

function compareAscending(left: SiteRow[keyof SiteRow], right: SiteRow[keyof SiteRow]) {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

describe("MultisiteService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: MultisiteService;

  beforeEach(() => {
    db = createMockDb([
      {
        id: 1,
        name: "Primary",
        domain: "localhost:3000",
        path: "/",
        status: "active",
        isPrimary: true,
        meta: {},
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
      {
        id: 2,
        name: "Docs",
        domain: "docs.example.com",
        path: "/docs/",
        status: "active",
        isPrimary: false,
        meta: {},
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
      {
        id: 3,
        name: "Docs Root",
        domain: "docs.example.com",
        path: "/",
        status: "active",
        isPrimary: false,
        meta: {},
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
      {
        id: 4,
        name: "Archived Docs",
        domain: "docs.example.com",
        path: "/archive/",
        status: "archived",
        isPrimary: false,
        meta: {},
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
    ]);
    service = new MultisiteService(db as never);
  });

  it("lists sites in ascending id order", async () => {
    const sites = await service.listSites();
    expect(sites.map((site) => site.id)).toEqual([1, 2, 3, 4]);
  });

  it("creates a site with normalized domain and path", async () => {
    const created = await service.createSite({
      name: "Store",
      domain: "Store.Example.com",
      path: "/shop",
      meta: { locale: "en" },
    });

    expect(created.domain).toBe("store.example.com");
    expect(created.path).toBe("/shop/");
    expect(created.status).toBe("active");
    expect(created.isPrimary).toBe(false);
  });

  it("rejects duplicate domain and path combinations after normalization", async () => {
    await expect(
      service.createSite({
        name: "Duplicate",
        domain: "DOCS.EXAMPLE.COM",
        path: "/docs/",
      })
    ).rejects.toThrow("already exists");
  });

  it("updates a non-primary site status and metadata", async () => {
    const updated = await service.updateSite(2, {
      status: "archived",
      meta: { locale: "fr" },
    });

    expect(updated.status).toBe("archived");
    expect(updated.meta).toEqual({ locale: "fr" });
  });

  it("keeps the primary site active even when called directly", async () => {
    await expect(service.updateSite(1, { status: "deleted" })).rejects.toThrow(
      "primary site must remain active"
    );
  });

  it("returns the primary site", async () => {
    const site = await service.getPrimarySite();
    expect(site?.id).toBe(1);
  });

  it("resolves the longest matching active site path for a domain", async () => {
    const site = await service.resolveSite("docs.example.com", "/docs/guides/getting-started");
    expect(site?.id).toBe(2);
  });

  it("falls back to the domain root site when no longer path matches", async () => {
    const site = await service.resolveSite("docs.example.com", "/pricing");
    expect(site?.id).toBe(3);
  });

  it("falls back to the primary site when no domain match exists", async () => {
    const site = await service.resolveSite("unknown.example.com", "/");
    expect(site?.id).toBe(1);
  });

  it("ignores archived sites during resolution", async () => {
    const site = await service.resolveSite("docs.example.com", "/archive/release-notes");
    expect(site?.id).toBe(3);
  });

  it("throws when a site is missing", async () => {
    await expect(service.getSiteById(99)).rejects.toThrow("Site with id 99 not found");
  });
});
