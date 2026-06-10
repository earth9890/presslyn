/**
 * Users Service
 *
 * WordPress equivalent: wp-includes/user.php
 * CRUD for users, authentication, session management.
 */

import { eq, and, like, sql, desc, asc, inArray } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import { users, sessions, passwordResetTokens } from "@presslyn/database";
import { hooks } from "../hooks.js";
import { NotFoundError, UnauthorizedError, ValidationError } from "../errors.js";
import { CreateUserSchema, UpdateUserSchema, UserListSchema, LoginSchema } from "../schemas.js";
import { escapeLike } from "../utils.js";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  getSessionExpiry,
  generateResetToken,
  hashResetToken,
  getResetTokenExpiry,
} from "./auth.js";
import { userCan, getRole } from "./roles.js";

/** Columns returned for user queries — never includes passwordHash. */
const userColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  role: users.role,
  meta: users.meta,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
  role?: string;
}

export interface UpdateUserInput {
  email?: string;
  displayName?: string;
  role?: string;
  meta?: Record<string, unknown>;
}

export interface UserListOptions {
  role?: string;
  search?: string;
  orderBy?: "id" | "username" | "email" | "created_at";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface AuthResult {
  user: Omit<typeof users.$inferSelect, "passwordHash">;
  sessionToken: string;
  expiresAt: Date;
}

export class UsersService {
  constructor(private db: Database) {}

  // ─── CRUD ────────────────────────────────────────────────

  async createUser(input: CreateUserInput) {
    // Validate input with Zod schema
    const parsed = CreateUserSchema.parse(input);

    // Validate role exists
    const roleName = parsed.role ?? "subscriber";
    if (!getRole(roleName)) {
      throw new ValidationError(`Role "${roleName}" does not exist`);
    }

    // Check unique email/username
    const [existingEmail] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.email))
      .limit(1);
    if (existingEmail) throw new ValidationError("Email already exists");

    const [existingUsername] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, parsed.username))
      .limit(1);
    if (existingUsername) throw new ValidationError("Username already exists");

    const passwordHash = await hashPassword(parsed.password);

    const [user] = await this.db
      .insert(users)
      .values({
        email: parsed.email,
        username: parsed.username,
        passwordHash,
        displayName: parsed.displayName,
        role: roleName,
      })
      .returning(userColumns);

    await hooks.doAction("user_register", user);
    return user;
  }

  async getUserById(id: number) {
    const [user] = await this.db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) throw new NotFoundError("User", id);
    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await this.db
      .select(userColumns)
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user ?? null;
  }

  async getUserByUsername(username: string) {
    const [user] = await this.db
      .select(userColumns)
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user ?? null;
  }

  async updateUser(id: number, input: UpdateUserInput) {
    // Validate input with Zod schema
    const parsed = UpdateUserSchema.parse(input);

    const user = await this.getUserById(id);

    if (parsed.role !== undefined && !getRole(parsed.role)) {
      throw new ValidationError(`Role "${parsed.role}" does not exist`);
    }

    if (parsed.email !== undefined && parsed.email !== user.email) {
      const [existing] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, parsed.email))
        .limit(1);
      if (existing) throw new ValidationError("Email already exists");
    }

    const [updated] = await this.db
      .update(users)
      .set({
        ...(parsed.email !== undefined && { email: parsed.email }),
        ...(parsed.displayName !== undefined && { displayName: parsed.displayName }),
        ...(parsed.role !== undefined && { role: parsed.role }),
        ...(parsed.meta !== undefined && { meta: parsed.meta }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning(userColumns);

    await hooks.doAction("profile_update", updated);
    return updated;
  }

  async deleteUser(id: number) {
    const user = await this.getUserById(id);
    await hooks.doAction("delete_user", user);

    // Delete sessions + user atomically so a mid-way failure can't leave one
    // without the other.
    await this.db.transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await tx.delete(users).where(eq(users.id, id));
    });

    return true;
  }

  async listUsers(opts: UserListOptions = {}) {
    // Validate input with Zod schema
    const parsed = UserListSchema.parse(opts);

    const {
      role,
      search,
      orderBy = "id",
      order = "asc",
      offset = 0,
    } = parsed;

    // Cap limit to 100
    const limit = Math.min(parsed.limit ?? 20, 100);

    // Build WHERE conditions
    const conditions = [];
    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (search) {
      conditions.push(like(users.username, `%${escapeLike(search)}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderCol = {
      id: users.id,
      username: users.username,
      email: users.email,
      created_at: users.createdAt,
    }[orderBy];

    const orderFn = order === "desc" ? desc : asc;

    const rows = await this.db
      .select(userColumns)
      .from(users)
      .where(whereClause)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset);

    // Get total count using the same filters
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);

    return { users: rows, total: countResult.count };
  }

  // ─── Authentication ──────────────────────────────────────

  async authenticate(login: string, password: string): Promise<AuthResult> {
    // Validate input with Zod schema
    const parsed = LoginSchema.parse({ login, password });

    // Login can be email or username — need passwordHash for verification
    const [userRow] = await this.db
      .select()
      .from(users)
      .where(
        parsed.login.includes("@")
          ? eq(users.email, parsed.login)
          : eq(users.username, parsed.login)
      )
      .limit(1);

    if (!userRow) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const valid = await verifyPassword(parsed.password, userRow.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Create session — store hashed token in DB
    const sessionToken = generateSessionToken();
    const hashedToken = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiry();

    await this.db.insert(sessions).values({
      id: hashedToken,
      userId: userRow.id,
      expiresAt,
    });

    // Strip passwordHash before returning
    const { passwordHash: _, ...user } = userRow;

    await hooks.doAction("user_login", user);
    return { user, sessionToken, expiresAt };
  }

  async validateSession(token: string) {
    const hashedToken = hashSessionToken(token);

    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, hashedToken))
      .limit(1);

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await this.db.delete(sessions).where(eq(sessions.id, hashedToken));
      return null;
    }

    const user = await this.getUserById(session.userId);
    return user;
  }

  async logout(token: string): Promise<void> {
    const hashedToken = hashSessionToken(token);
    await this.db.delete(sessions).where(eq(sessions.id, hashedToken));
  }

  async changePassword(userId: number, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);

    // Stamp a revocation watermark so JWTs issued before now are rejected
    // (the REST layer compares the token's `iat` against this). Merge into
    // existing meta rather than clobbering it.
    const current = await this.getUserById(userId);
    const meta = {
      ...((current.meta as Record<string, unknown>) ?? {}),
      tokensValidAfter: Math.floor(Date.now() / 1000),
    };

    await this.db
      .update(users)
      .set({ passwordHash, meta, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Invalidate all DB sessions for this user
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /**
   * Self-service password change. Verifies the current password before
   * setting the new one (timing-safe via the argon2 verifier). Used by the
   * own-profile screen, unlike the admin reset path (`changePassword`).
   */
  async changeOwnPassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const [row] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) throw new NotFoundError("User", userId);

    const valid = await verifyPassword(currentPassword, row.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    await this.changePassword(userId, newPassword);
  }

  /**
   * Bulk-assign a role to multiple users in a single UPDATE (no N+1).
   * Returns the number of rows updated. Validates the role exists first.
   */
  async bulkUpdateRole(userIds: number[], role: string): Promise<number> {
    const ids = [...new Set(userIds)].filter(
      (id) => Number.isInteger(id) && id > 0
    );
    if (ids.length === 0) return 0;
    if (!getRole(role)) {
      throw new ValidationError(`Role "${role}" does not exist`);
    }

    const updated = await this.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(inArray(users.id, ids))
      .returning({ id: users.id });

    for (const row of updated) {
      await hooks.doAction("set_user_role", row.id, role);
    }
    return updated.length;
  }

  // ─── Password Reset Tokens ───────────────────────────────

  /**
   * Issue a single-use, time-limited password-reset token for the account
   * matching `email`. Returns the raw token + the user (for the email layer)
   * when the account exists, or `null` when it does not — callers MUST treat
   * both cases identically to avoid leaking which emails are registered.
   *
   * Any outstanding tokens for the user are invalidated first so only the
   * most recent link works.
   */
  async createPasswordResetToken(email: string): Promise<{
    token: string;
    user: Omit<typeof users.$inferSelect, "passwordHash">;
    expiresAt: Date;
  } | null> {
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!normalized) return null;

    const [userRow] = await this.db
      .select(userColumns)
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    if (!userRow) return null;

    // Invalidate any previous tokens for this user.
    await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userRow.id));

    const token = generateResetToken();
    const expiresAt = getResetTokenExpiry();

    await this.db.insert(passwordResetTokens).values({
      id: hashResetToken(token),
      userId: userRow.id,
      expiresAt,
    });

    await hooks.doAction("password_reset_requested", userRow);
    return { token, user: userRow, expiresAt };
  }

  /**
   * Consume a password-reset token and set a new password. Validates that the
   * token exists, is unexpired, and is unused. Marks the token used, sets the
   * new password, and (via changePassword) invalidates all existing sessions.
   * Throws UnauthorizedError for any invalid/expired/used token.
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string
  ): Promise<void> {
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    const hashed = hashResetToken(String(token ?? ""));
    const [record] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, hashed))
      .limit(1);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired reset token");
    }

    // Mark used before mutating the password so a crash can't leave a
    // re-usable token behind.
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, hashed));

    await this.changePassword(record.userId, newPassword);
    await hooks.doAction("password_reset_completed", record.userId);
  }

  // ─── Session Cleanup ─────────────────────────────────────

  /**
   * Remove all expired sessions from the database.
   * Should be called periodically (e.g., via cron).
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db
      .delete(sessions)
      .where(sql`${sessions.expiresAt} < now()`)
      .returning({ id: sessions.id });

    return result.length;
  }

  // ─── Capabilities ────────────────────────────────────────

  currentUserCan(user: { role: string }, capability: string): boolean {
    return userCan(user.role, capability);
  }
}
