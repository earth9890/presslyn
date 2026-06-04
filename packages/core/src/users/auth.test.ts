import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry,
} from "./auth.js";

describe("hashPassword", () => {
  it("should return an argon2id hash string", async () => {
    const hash = await hashPassword("testpassword");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("should produce different hashes for the same password (unique salts)", async () => {
    const hash1 = await hashPassword("samepassword");
    const hash2 = await hashPassword("samepassword");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle minimum password length", async () => {
    const hash = await hashPassword("12345678");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("should handle long passwords", async () => {
    const hash = await hashPassword("a".repeat(128));
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("should handle unicode passwords", async () => {
    const hash = await hashPassword("пароль密码パスワード");
    expect(hash).toMatch(/^\$argon2id\$/);
  });
});

describe("verifyPassword", () => {
  it("should return true for correct password", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await verifyPassword("correctpassword", hash);
    expect(result).toBe(true);
  });

  it("should return false for wrong password", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });

  it("should return false for empty password against valid hash", async () => {
    const hash = await hashPassword("realpassword");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });

  it("should return false for corrupted hash", async () => {
    const result = await verifyPassword("password", "not-a-valid-hash");
    expect(result).toBe(false);
  });

  it("should return false for empty hash", async () => {
    const result = await verifyPassword("password", "");
    expect(result).toBe(false);
  });
});

describe("generateSessionToken", () => {
  it("should return a hex string of 96 characters (48 bytes)", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[a-f0-9]{96}$/);
  });

  it("should generate unique tokens each time", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("hashSessionToken", () => {
  it("should return a SHA-256 hex hash (64 chars)", () => {
    const hash = hashSessionToken("abcdef1234567890");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce deterministic output", () => {
    const hash1 = hashSessionToken("same-token");
    const hash2 = hashSessionToken("same-token");
    expect(hash1).toBe(hash2);
  });

  it("should produce different output for different tokens", () => {
    const hash1 = hashSessionToken("token-a");
    const hash2 = hashSessionToken("token-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("getSessionExpiry", () => {
  it("should return a date 14 days in the future by default", () => {
    const now = new Date();
    const expiry = getSessionExpiry();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(14, 0);
  });

  it("should accept custom day count", () => {
    const now = new Date();
    const expiry = getSessionExpiry(7);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("should throw for zero days", () => {
    expect(() => getSessionExpiry(0)).toThrow("Session expiry must be a positive");
  });

  it("should throw for negative days", () => {
    expect(() => getSessionExpiry(-5)).toThrow("Session expiry must be a positive");
  });
});
