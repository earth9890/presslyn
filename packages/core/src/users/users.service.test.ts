import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => (row: Record<string, unknown>) =>
    row[field] === value,
  and:
    (...predicates: Array<(row: Record<string, unknown>) => boolean>) =>
    (row: Record<string, unknown>) =>
      predicates.every((predicate) => predicate(row)),
  inArray:
    (_field: string, values: unknown[]) => (row: Record<string, unknown>) =>
      values.includes(row.id),
  like: () => () => true,
  desc: () => "desc",
  asc: () => "asc",
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ strings, values }) as unknown as T,
}));

vi.mock("@presslyn/database", () => ({
  users: {
    id: "id",
    email: "email",
    username: "username",
    displayName: "displayName",
    role: "role",
    passwordHash: "passwordHash",
    meta: "meta",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  sessions: { id: "id", userId: "userId", expiresAt: "expiresAt" },
}));

// Avoid real argon2 work — stub the auth primitives.
vi.mock("./auth.js", () => ({
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
  verifyPassword: vi.fn(
    async (pw: string, hash: string) => hash === `hashed:${pw}`
  ),
  generateSessionToken: () => "token",
  hashSessionToken: (t: string) => `h:${t}`,
  getSessionExpiry: () => new Date("2099-01-01T00:00:00.000Z"),
}));

interface UserRow {
  id: number;
  email: string;
  username: string;
  displayName: string;
  role: string;
  passwordHash: string;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

function createMockDb(initial: UserRow[]) {
  let rows = initial.map((r) => ({ ...r }));
  const deletedSessionsFor: number[] = [];

  return {
    db: {
      select: vi.fn((shape?: Record<string, unknown>) => ({
        from: vi.fn(() => ({
          where: vi.fn((predicate: (row: UserRow) => boolean) => ({
            limit: vi.fn(async () =>
              rows.filter(predicate).map((row) =>
                shape
                  ? Object.fromEntries(
                      Object.keys(shape).map((k) => [k, row[k as keyof UserRow]])
                    )
                  : { ...row }
              )
            ),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((value: Partial<UserRow>) => ({
          where: vi.fn((predicate: (row: UserRow) => boolean) => ({
            returning: vi.fn(async () => {
              rows = rows.map((row) =>
                predicate(row) ? { ...row, ...value } : row
              );
              return rows.filter(predicate).map((row) => ({ id: row.id }));
            }),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async (predicate: (row: { userId: number }) => boolean) => {
          // Track which user's sessions were cleared.
          for (const r of rows) {
            if (predicate({ userId: r.id })) deletedSessionsFor.push(r.id);
          }
          return [];
        }),
      })),
    } as never,
    getRows: () => rows,
  };
}

describe("UsersService.bulkUpdateRole", () => {
  let service: UsersService;
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb([
      mkUser(1, "subscriber"),
      mkUser(2, "subscriber"),
      mkUser(3, "author"),
    ]);
    service = new UsersService(mock.db);
  });

  it("assigns a role to multiple users in one call", async () => {
    const count = await service.bulkUpdateRole([1, 2], "editor");
    expect(count).toBe(2);
    const rows = mock.getRows();
    expect(rows.find((r) => r.id === 1)?.role).toBe("editor");
    expect(rows.find((r) => r.id === 2)?.role).toBe("editor");
    expect(rows.find((r) => r.id === 3)?.role).toBe("author");
  });

  it("deduplicates ids and ignores invalid ones", async () => {
    const count = await service.bulkUpdateRole([1, 1, -5, 0], "author");
    expect(count).toBe(1);
  });

  it("returns 0 for an empty list without touching the db", async () => {
    expect(await service.bulkUpdateRole([], "editor")).toBe(0);
  });

  it("rejects an unknown role", async () => {
    await expect(service.bulkUpdateRole([1], "wizard")).rejects.toThrow(
      /does not exist/
    );
  });
});

describe("UsersService.changeOwnPassword", () => {
  let service: UsersService;

  beforeEach(() => {
    const mock = createMockDb([{ ...mkUser(1, "editor"), passwordHash: "hashed:correct" }]);
    service = new UsersService(mock.db);
  });

  it("updates the password when the current one matches", async () => {
    await expect(
      service.changeOwnPassword(1, "correct", "brand-new-password")
    ).resolves.toBeUndefined();
  });

  it("rejects when the current password is wrong", async () => {
    await expect(
      service.changeOwnPassword(1, "wrong", "brand-new-password")
    ).rejects.toThrow(/incorrect/);
  });

  it("rejects for a missing user", async () => {
    await expect(
      service.changeOwnPassword(999, "correct", "brand-new-password")
    ).rejects.toThrow();
  });
});

function mkUser(id: number, role: string): UserRow {
  return {
    id,
    email: `user${id}@example.com`,
    username: `user${id}`,
    displayName: `User ${id}`,
    role,
    passwordHash: "hashed:pw",
    meta: {},
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    updatedAt: new Date("2026-06-07T00:00:00.000Z"),
  };
}
