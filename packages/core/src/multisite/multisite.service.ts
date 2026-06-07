import { and, asc, eq } from "drizzle-orm";
import { type Database, sites } from "@presslyn/database";
import { NotFoundError, ValidationError } from "../errors.js";
import { CreateSiteSchema, UpdateSiteSchema } from "../schemas.js";

export interface CreateSiteInput {
  name: string;
  domain: string;
  path?: string;
  meta?: Record<string, unknown>;
}

export interface UpdateSiteInput {
  name?: string;
  domain?: string;
  path?: string;
  status?: "active" | "archived" | "deleted";
  meta?: Record<string, unknown>;
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

function normalizePath(pathname?: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.trim();
  if (!trimmed.startsWith("/")) {
    throw new ValidationError("path must start with /");
  }
  if (trimmed === "/") return "/";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function isPathMatch(sitePath: string, pathname: string): boolean {
  if (sitePath === "/") {
    return true;
  }

  if (!pathname.startsWith(sitePath)) {
    return false;
  }

  return pathname.length === sitePath.length || pathname.charAt(sitePath.length) !== "/";
}

export class MultisiteService {
  constructor(private readonly db: Database) {}

  async listSites() {
    return this.db.select().from(sites).orderBy(asc(sites.id));
  }

  async getSiteById(id: number) {
    const [site] = await this.db
      .select()
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);

    if (!site) {
      throw new NotFoundError("Site", id);
    }

    return site;
  }

  async createSite(input: CreateSiteInput) {
    const parsed = CreateSiteSchema.parse(input);
    const domain = normalizeDomain(parsed.domain);
    const path = normalizePath(parsed.path);

    const [existing] = await this.db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.domain, domain), eq(sites.path, path)))
      .limit(1);

    if (existing) {
      throw new ValidationError("A site with this domain and path already exists");
    }

    const [created] = await this.db
      .insert(sites)
      .values({
        name: parsed.name,
        domain,
        path,
        status: "active",
        isPrimary: false,
        meta: parsed.meta ?? {},
      })
      .returning();

    return created;
  }

  async updateSite(id: number, input: UpdateSiteInput) {
    const current = await this.getSiteById(id);
    const parsed = UpdateSiteSchema.parse(input);
    const nextPath = parsed.path !== undefined ? normalizePath(parsed.path) : current.path;
    const nextDomain =
      parsed.domain !== undefined ? normalizeDomain(parsed.domain) : current.domain;

    if (
      current.isPrimary &&
      parsed.status !== undefined &&
      parsed.status !== "active"
    ) {
      throw new ValidationError("The primary site must remain active");
    }

    const [collision] = await this.db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.domain, nextDomain), eq(sites.path, nextPath)))
      .limit(1);

    if (collision && collision.id !== id) {
      throw new ValidationError("A site with this domain and path already exists");
    }

    const [updated] = await this.db
      .update(sites)
      .set({
        name: parsed.name ?? current.name,
        domain: nextDomain,
        path: nextPath,
        status: parsed.status ?? current.status,
        meta: parsed.meta ?? current.meta,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, id))
      .returning();

    return updated;
  }

  async getPrimarySite() {
    const [site] = await this.db
      .select()
      .from(sites)
      .where(eq(sites.isPrimary, true))
      .limit(1);

    return site ?? null;
  }

  async resolveSite(domain: string, pathname = "/") {
    const normalizedDomain = normalizeDomain(domain);
    const normalizedPath = normalizePath(pathname);

    const candidates = await this.db
      .select()
      .from(sites)
      .where(and(eq(sites.domain, normalizedDomain), eq(sites.status, "active")));

    const matched = candidates
      .filter((site) => isPathMatch(site.path, normalizedPath))
      .sort((left, right) => right.path.length - left.path.length)[0];

    if (matched) {
      return matched;
    }

    const primary = await this.getPrimarySite();
    if (primary?.status === "active") {
      return primary;
    }

    return null;
  }
}
