import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service.js";
import { hashResetToken } from "./auth.js";

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => ({ field, value }),
  and: (...preds: unknown[]) => ({ and: preds }),
  inArray: (field: string, values: unknown[]) => ({ field, values }),
  like: () => ({}),
  desc: () => "desc",
  asc: () => "asc",
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ strings, values }) as unknown as T,
}));

vi.mock("@presslyn/database", () => ({
  users: { __table: "users", id: "id", email: "email", passwordHash: "passwordHash" },
  sessions: { __table: "sessions", userId: "userId" },
  passwordResetTokens: {
    __table: "password_reset_tokens",
    id: "id",
    userId: "userId",
    expiresAt: "expiresAt",
    usedAt: "usedAt",
  },
}));

vi.mock("./auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth.js")>();
  return {
    ...actual,
    hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
  };
});

interface TokenRow {
  id: string;
  userId: number;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Minimal table-aware mock that supports the createPasswordResetToken and
 * resetPasswordWithToken query chains.
 */
function createMockDb() {
  const usersRows = [
    { id: 1, email: "alice@example.com", passwordHash: "hashed:old", displayName: "Alice", username: "alice", role: "editor", meta: {}, createdAt: new Date(), updatedAt: new Date() },
  ];
  let tokens: TokenRow[] = [];
  const tableOf = (t: { __table?: string }) => t.__table;

  const db = {
    select: vi.fn((_shape?: unknown) => ({
      from: vi.fn((table: { __table?: string }) => ({
        where: vi.fn((cond: { field: string; value: unknown }) => ({
          limit: vi.fn(async () => {
            if (tableOf(table) === "users") {
              return usersRows.filter((u) => (u as never)[cond.field] === cond.value);
            }
            if (tableOf(table) === "password_reset_tokens") {
              return tokens.filter((t) => (t as never)[cond.field] === cond.value);
            }
            return [];
          }),
        })),
      })),
    })),
    insert: vi.fn((table: { __table?: string }) => ({
      values: vi.fn(async (value: TokenRow) => {
        if (tableOf(table) === "password_reset_tokens") {
          tokens.push({ ...value, usedAt: value.usedAt ?? null });
        }
        return [];
      }),
    })),
    update: vi.fn((table: { __table?: string }) => ({
      set: vi.fn((value: Partial<TokenRow>) => ({
        where: vi.fn(async (cond: { field: string; value: unknown }) => {
          if (tableOf(table) === "password_reset_tokens") {
            tokens = tokens.map((t) =>
              (t as never)[cond.field] === cond.value ? { ...t, ...value } : t
            );
          }
          return [];
        }),
      })),
    })),
    delete: vi.fn((table: { __table?: string }) => ({
      where: vi.fn(async (cond: { field: string; value: unknown }) => {
        if (tableOf(table) === "password_reset_tokens") {
          tokens = tokens.filter((t) => (t as never)[cond.field] !== cond.value);
        }
        return [];
      }),
    })),
  } as never;

  return { db, getTokens: () => tokens };
}

describe("UsersService password reset tokens", () => {
  let service: UsersService;
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mock = createMockDb();
    service = new UsersService(mock.db);
  });

  it("issues a token for a known email and stores only its hash", async () => {
    const issued = await service.createPasswordResetToken("alice@example.com");
    expect(issued).not.toBeNull();
    expect(issued!.token).toHaveLength(96); // 48 bytes hex
    const stored = mock.getTokens();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(hashResetToken(issued!.token));
    expect(stored[0]!.id).not.toBe(issued!.token);
  });

  it("returns null for an unknown email (no enumeration)", async () => {
    expect(await service.createPasswordResetToken("nobody@example.com")).toBeNull();
  });

  it("resets the password with a valid token and marks it used", async () => {
    const issued = await service.createPasswordResetToken("alice@example.com");
    await expect(
      service.resetPasswordWithToken(issued!.token, "a-brand-new-password")
    ).resolves.toBeUndefined();
    expect(mock.getTokens()[0]!.usedAt).toBeInstanceOf(Date);
  });

  it("rejects a reused token", async () => {
    const issued = await service.createPasswordResetToken("alice@example.com");
    await service.resetPasswordWithToken(issued!.token, "a-brand-new-password");
    await expect(
      service.resetPasswordWithToken(issued!.token, "another-password")
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects an unknown token", async () => {
    await expect(
      service.resetPasswordWithToken("deadbeef", "a-brand-new-password")
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects an expired token", async () => {
    const issued = await service.createPasswordResetToken("alice@example.com");
    // Force-expire the stored token.
    const stored = mock.getTokens();
    stored[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(
      service.resetPasswordWithToken(issued!.token, "a-brand-new-password")
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects a too-short new password before touching the token", async () => {
    const issued = await service.createPasswordResetToken("alice@example.com");
    await expect(
      service.resetPasswordWithToken(issued!.token, "short")
    ).rejects.toThrow(/at least 8/i);
  });
});
