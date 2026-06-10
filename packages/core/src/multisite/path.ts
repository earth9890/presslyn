/**
 * Pure (DB-free) helpers for subdirectory multisite routing.
 *
 * These are safe to import from edge middleware — they have no database or
 * Node-only dependencies. `MultisiteService.resolveSite` uses the same
 * matching semantics for DB-backed resolution.
 */

/** Normalize a site base path: leading slash, trailing slash (except root). */
export function normalizeSitePath(path: string | undefined | null): string {
  if (!path) return "/";
  let p = path.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p === "/") return "/";
  return p.endsWith("/") ? p : `${p}/`;
}

/**
 * True when `pathname` falls under the site mounted at `sitePath`. A root site
 * ("/") matches everything; a subdirectory site matches its base and anything
 * beneath it, but never a sibling whose name merely shares the prefix
 * (e.g. site "/blog" does not match "/blogging").
 */
export function isPathUnderSite(sitePath: string, pathname: string): boolean {
  const base = normalizeSitePath(sitePath);
  if (base === "/") return true;
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalized === base || normalized.startsWith(base);
}

/**
 * Strip a site's base path from a request pathname, returning the in-site
 * pathname (always leading-slash, no trailing slash except root). Returns the
 * original pathname unchanged when it isn't under the site.
 *
 *   stripSitePath("/blog/hello", "/blog") -> "/hello"
 *   stripSitePath("/blog", "/blog")       -> "/"
 *   stripSitePath("/other", "/blog")      -> "/other"
 */
export function stripSitePath(pathname: string, sitePath: string): string {
  const base = normalizeSitePath(sitePath);
  if (base === "/") return pathname || "/";
  if (!isPathUnderSite(base, pathname)) return pathname;

  // base has a trailing slash; remove all but the leading slash of it.
  const baseNoTrailing = base.slice(0, -1); // "/blog"
  const remainder = pathname.slice(baseNoTrailing.length); // "/hello" | "" | "/"
  if (remainder === "" || remainder === "/") return "/";
  return remainder.endsWith("/") && remainder.length > 1
    ? remainder.slice(0, -1)
    : remainder;
}

/**
 * Given a request pathname and a list of known site base paths, return the
 * longest matching base path (or null). Used to pick which subdirectory site a
 * request belongs to when several are configured.
 */
export function matchSiteBasePath(
  pathname: string,
  basePaths: string[]
): string | null {
  return (
    basePaths
      .map(normalizeSitePath)
      .filter((base) => base !== "/" && isPathUnderSite(base, pathname))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}
