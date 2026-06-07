import { beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsService } from "./options.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => (row: Record<string, unknown>) => row[field] === value,
  and:
    (...predicates: Array<(row: Record<string, unknown>) => boolean>) =>
    (row: Record<string, unknown>) =>
      predicates.every((predicate) => predicate(row)),
}));

vi.mock("@presslyn/database", () => ({
  options: {
    id: "id",
    siteId: "siteId",
    key: "key",
    value: "value",
    autoload: "autoload",
  },
  sites: {
    id: "id",
    isPrimary: "isPrimary",
  },
}));

interface SiteRow {
  id: number;
  isPrimary: boolean;
}

interface OptionRow {
  id: number;
  siteId: number;
  key: string;
  value: unknown;
  autoload: boolean;
}

function createMockDb(initialSites: SiteRow[], initialOptions: OptionRow[]) {
  let sitesRows = initialSites.map((row) => ({ ...row }));
  let optionRows = initialOptions.map((row) => ({ ...row }));

  const queryResult = <T,>(result: T[]) => ({
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(result).then(resolve),
    limit: vi.fn(async (limit: number) => result.slice(0, limit)),
  });

  const fromRows = (table: string) => (table === "sites" ? sitesRows : optionRows);

  return {
    select: vi.fn((shape?: Record<string, unknown>) => ({
      from: vi.fn((table: Record<string, string>) => {
        const tableName = "isPrimary" in table ? "sites" : "options";
        const project = (row: Record<string, unknown>) =>
          shape
            ? Object.fromEntries(
                Object.keys(shape).map((key) => [key, row[key]])
              )
            : { ...row };

        return {
          where: vi.fn((predicate: (row: Record<string, unknown>) => boolean) =>
            queryResult(fromRows(tableName).filter(predicate).map(project))
          ),
        };
      }),
    })),
    insert: vi.fn((table: Record<string, string>) => ({
      values: vi.fn((value: Record<string, unknown>) => {
        if ("isPrimary" in table) {
          const created = { id: sitesRows.length + 1, ...value } as SiteRow;
          sitesRows.push(created);
          return {
            returning: vi.fn(async () => [{ ...created }]),
          };
        }

        const created = { id: optionRows.length + 1, ...value } as OptionRow;
        optionRows.push(created);
        return {
          returning: vi.fn(async () => [{ ...created }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: Partial<OptionRow>) => ({
        where: vi.fn(async (predicate: (row: OptionRow) => boolean) => {
          optionRows = optionRows.map((row) =>
            predicate(row) ? { ...row, ...value } : row
          );
          return optionRows;
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((predicate: (row: OptionRow) => boolean) => ({
        returning: vi.fn(async () => {
          const deleted = optionRows.filter(predicate);
          optionRows = optionRows.filter((row) => !predicate(row));
          return deleted;
        }),
      })),
    })),
    snapshotOptions: () => optionRows.map((row) => ({ ...row })),
  };
}

describe("OptionsService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: OptionsService;

  beforeEach(() => {
    db = createMockDb(
      [
        { id: 1, isPrimary: true },
        { id: 2, isPrimary: false },
      ],
      [
        { id: 1, siteId: 1, key: "blogname", value: "Primary Site", autoload: true },
        { id: 2, siteId: 2, key: "blogname", value: "Docs Site", autoload: true },
        { id: 3, siteId: 1, key: "posts_per_page", value: 10, autoload: true },
      ]
    );
    service = new OptionsService(db as never);
  });

  it("uses the primary site when no scope is provided", async () => {
    await expect(service.getOption("blogname")).resolves.toBe("Primary Site");
  });

  it("reads site-scoped options when a site id is provided", async () => {
    await expect(service.getOption("blogname", null, { siteId: 2 })).resolves.toBe("Docs Site");
  });

  it("returns the default when a scoped option is missing", async () => {
    await expect(service.getOption("tagline", "Fallback", { siteId: 2 })).resolves.toBe(
      "Fallback"
    );
  });

  it("updates only the scoped option row", async () => {
    await service.updateOption("blogname", "Docs Updated", true, { siteId: 2 });

    const rows = db.snapshotOptions();
    expect(rows.find((row) => row.siteId === 2 && row.key === "blogname")?.value).toBe(
      "Docs Updated"
    );
    expect(rows.find((row) => row.siteId === 1 && row.key === "blogname")?.value).toBe(
      "Primary Site"
    );
  });

  it("creates a new site-scoped option row when needed", async () => {
    await service.updateOption("timezone_string", "Asia/Kolkata", true, { siteId: 2 });

    const rows = db.snapshotOptions();
    expect(
      rows.find((row) => row.siteId === 2 && row.key === "timezone_string")?.value
    ).toBe("Asia/Kolkata");
  });

  it("filters getAllOptions to the requested site", async () => {
    const result = await service.getAllOptions({ siteId: 2 });
    expect(result).toEqual({ blogname: "Docs Site" });
  });
});
