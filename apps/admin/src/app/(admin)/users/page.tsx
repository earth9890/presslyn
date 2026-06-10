import Link from "next/link";
import { Search01Icon } from "hugeicons-react";
import { services } from "@/lib/services";
import { UsersTable } from "@/components/users/users-table";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    search?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const params = await searchParams;
  const role = params.role ?? "all";
  const search = params.search ?? "";
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.perPage ?? 20)));
  const offset = (page - 1) * limit;

  const [filteredResult, allResult] = await Promise.all([
    services.users.listUsers({
      role: role !== "all" ? role : undefined,
      search: search || undefined,
      orderBy: "id",
      order: "asc",
      limit,
      offset,
    }),
    services.users.listUsers({ limit: 100 }),
  ]);

  const userList = filteredResult.users;

  const roleCounts: Record<string, number> = { all: allResult.total };
  for (const u of allResult.users) {
    roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1;
  }

  const roleTabs = [
    { key: "all", label: "All", count: roleCounts.all },
    { key: "administrator", label: "Administrators", count: roleCounts.administrator ?? 0 },
    { key: "editor", label: "Editors", count: roleCounts.editor ?? 0 },
    { key: "author", label: "Authors", count: roleCounts.author ?? 0 },
    { key: "contributor", label: "Contributors", count: roleCounts.contributor ?? 0 },
    { key: "subscriber", label: "Subscribers", count: roleCounts.subscriber ?? 0 },
  ].filter((t) => t.key === "all" || t.count > 0);
  const buildUsersHref = (updates: Record<string, string | number | undefined>) =>
    buildListHref("/users", {
      role,
      search,
      page,
      perPage: limit,
      ...updates,
    });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
          {roleTabs.map((tab) => (
            <Link
              key={tab.key}
              href={buildUsersHref({ role: tab.key, page: 1 })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                role === tab.key
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  role === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-surface-raised text-text-muted"
                }`}
              >
                {tab.count}
              </span>
            </Link>
          ))}
        </div>

        <form method="GET" className="relative">
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="perPage" value={limit} />
          <Search01Icon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            name="search"
            defaultValue={search}
            placeholder="Search users…"
            className="w-56 rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </form>
      </div>

      {/* Table */}
      <UsersTable
        users={userList.map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          createdAt:
            user.createdAt instanceof Date
              ? user.createdAt.toISOString()
              : (user.createdAt ?? null),
        }))}
      />

      {filteredResult.total > limit ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-text-muted">
            Showing {offset + 1}–
            {Math.min(offset + userList.length, filteredResult.total)} of{" "}
            {filteredResult.total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildUsersHref({ page: page - 1 })}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
              >
                Previous
              </Link>
            ) : null}
            {offset + limit < filteredResult.total ? (
              <Link
                href={buildUsersHref({ page: page + 1 })}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildListHref(
  pathname: string,
  params: Record<string, string | number | undefined>
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") {
      continue;
    }

    query.set(key, String(value));
  }

  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
