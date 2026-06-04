import Link from "next/link";
import { Search01Icon, UserCircleIcon } from "hugeicons-react";
import { services } from "@/lib/services";
import { UserRowActions } from "@/components/users/user-row-actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
  contributor: "Contributor",
  subscriber: "Subscriber",
};

const ROLE_STYLES: Record<string, string> = {
  administrator: "bg-danger/10 text-danger border-danger/20",
  editor: "bg-accent/10 text-accent border-accent/20",
  author: "bg-success/10 text-success border-success/20",
  contributor: "bg-warning/10 text-warning border-warning/20",
  subscriber: "bg-text-muted/10 text-text-secondary border-border",
};

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
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {userList.length === 0 ? (
          <div className="py-16 text-center">
            <UserCircleIcon size={32} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-secondary">No users found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-left">
                <th className="w-8 px-4 py-3">
                  <input type="checkbox" className="rounded border-border" aria-label="Select all" />
                </th>
                <th className="px-4 py-3 font-medium text-text-primary">User</th>
                <th
                  data-column="email"
                  className="hidden px-4 py-3 font-medium text-text-primary sm:table-cell"
                >
                  Email
                </th>
                <th
                  data-column="role"
                  className="hidden px-4 py-3 font-medium text-text-primary md:table-cell"
                >
                  Role
                </th>
                <th
                  data-column="joined"
                  className="hidden px-4 py-3 font-medium text-text-primary lg:table-cell"
                >
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {userList.map((user) => {
                const initials = (user.displayName || user.username)
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <tr key={user.id} className="group hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-border" aria-label={`Select ${user.username}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/users/${user.id}/edit`}
                            className="block truncate font-medium text-text-primary hover:text-accent transition-colors"
                          >
                            {user.displayName || user.username}
                          </Link>
                          <p className="truncate text-xs text-text-muted">@{user.username}</p>
                          <UserRowActions userId={user.id} username={user.username} />
                        </div>
                      </div>
                    </td>
                    <td
                      data-column="email"
                      className="hidden px-4 py-3 text-text-secondary sm:table-cell"
                    >
                      {user.email}
                    </td>
                    <td
                      data-column="role"
                      className="hidden px-4 py-3 md:table-cell"
                    >
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLES[user.role] ?? "bg-surface-raised text-text-secondary border-border"}`}
                      >
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td
                      data-column="joined"
                      className="hidden px-4 py-3 text-text-muted lg:table-cell"
                    >
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
