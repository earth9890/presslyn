import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaxonomyService } from "./taxonomy.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => (row: Record<string, unknown>) => row[field] === value,
  and:
    (...predicates: Array<(row: Record<string, unknown>) => boolean>) =>
    (row: Record<string, unknown>) =>
      predicates.every((predicate) => predicate(row)),
  like: () => () => true,
  desc: () => "desc",
  asc: () => "asc",
  isNull: (field: string) => (row: Record<string, unknown>) => row[field] == null,
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ strings, values }) as unknown as T,
}));

vi.mock("@presslyn/database", () => ({
  taxonomies: { id: "id", slug: "slug", hierarchical: "hierarchical" },
  terms: {
    id: "id",
    siteId: "siteId",
    taxonomyId: "taxonomyId",
    name: "name",
    slug: "slug",
    description: "description",
    parentId: "parentId",
    meta: "meta",
  },
  postTerms: { termId: "termId", postId: "postId" },
  posts: { id: "id", siteId: "siteId" },
  sites: { id: "id", isPrimary: "isPrimary" },
}));

interface TaxonomyRow {
  id: number;
  slug: string;
  hierarchical: boolean;
}

interface TermRow {
  id: number;
  siteId: number;
  taxonomyId: number;
  name: string;
  slug: string;
  description: string;
  parentId: number | null;
  meta: Record<string, unknown>;
}

function createMockDb(initialTaxonomies: TaxonomyRow[], initialTerms: TermRow[]) {
  const taxonomiesRows = initialTaxonomies.map((row) => ({ ...row }));
  const termsRows = initialTerms.map((row) => ({ ...row }));

  const buildResult = <T,>(result: T[]) => {
    const chain = {
      then: (resolve: (value: T[]) => unknown) => Promise.resolve(result).then(resolve),
      limit: vi.fn((limit: number) => Promise.resolve(result.slice(0, limit))),
      orderBy: vi.fn(() => ({
        limit: vi.fn((limit: number) => ({
          offset: vi.fn((offset: number) => Promise.resolve(result.slice(offset, offset + limit))),
        })),
      })),
      groupBy: vi.fn(() => ({
        orderBy: vi.fn(async () => result),
      })),
    };

    return chain;
  };

  return {
    select: vi.fn((shape?: Record<string, unknown>) => ({
      from: vi.fn((table: Record<string, string>) => {
        const isTaxonomies = "hierarchical" in table;
        const rows = isTaxonomies ? taxonomiesRows : termsRows;
        return {
          where: vi.fn((predicate: (row: Record<string, unknown>) => boolean) =>
            buildResult(
              rows
                .filter(predicate)
                .map((row) =>
                  shape
                    ? Object.fromEntries(
                        Object.keys(shape).map((key) => [key, row[key as keyof typeof row]])
                      )
                    : { ...row }
                )
            )
          ),
          leftJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn((predicate: (row: Record<string, unknown>) => boolean) =>
                buildResult(
                  termsRows
                    .filter(predicate)
                    .map((row) => ({
                      term: { ...row },
                      count: row.siteId === 1 ? 2 : 1,
                    }))
                )
              ),
            })),
          })),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: Partial<TermRow>) => ({
        returning: vi.fn(async () => {
          const created: TermRow = {
            id: termsRows.length + 1,
            siteId: Number(value.siteId ?? 1),
            taxonomyId: Number(value.taxonomyId),
            name: String(value.name),
            slug: String(value.slug),
            description: String(value.description ?? ""),
            parentId: (value.parentId as number | null | undefined) ?? null,
            meta: (value.meta as Record<string, unknown> | undefined) ?? {},
          };
          termsRows.push(created);
          return [{ ...created }];
        }),
      })),
    })),
  } as never;
}

describe("TaxonomyService multisite scoping", () => {
  let service: TaxonomyService;

  beforeEach(() => {
    service = new TaxonomyService(
      createMockDb(
        [
          { id: 1, slug: "category", hierarchical: true },
          { id: 2, slug: "post_tag", hierarchical: false },
        ],
        [
          {
            id: 1,
            siteId: 1,
            taxonomyId: 1,
            name: "News",
            slug: "news",
            description: "",
            parentId: null,
            meta: {},
          },
          {
            id: 2,
            siteId: 2,
            taxonomyId: 1,
            name: "Docs News",
            slug: "news",
            description: "",
            parentId: null,
            meta: {},
          },
        ]
      )
    );
  });

  it("resolves terms by slug within the requested site", async () => {
    const primary = await service.getTermBySlug("news", "category", { siteId: 1 });
    const docs = await service.getTermBySlug("news", "category", { siteId: 2 });

    expect(primary?.name).toBe("News");
    expect(docs?.name).toBe("Docs News");
  });

  it("keeps duplicate slugs isolated by site", async () => {
    const created = await service.createTerm(
      {
        taxonomySlug: "category",
        name: "News",
      },
      { siteId: 3 }
    );

    expect(created.slug).toBe("news");
  });

  it("filters counted terms by site", async () => {
    const counted = await service.getTermsWithCounts("category", { siteId: 2 });
    expect(counted).toHaveLength(1);
    expect(counted[0]?.siteId).toBe(2);
  });
});
