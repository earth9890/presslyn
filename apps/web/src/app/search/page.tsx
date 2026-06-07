import type { Metadata } from "next";
import { services } from "@/lib/services";
import { getSiteSettings } from "@/lib/site";
import { toPostCards } from "@/lib/posts";
import { ArchiveList } from "@/components/archive-list";
import { getActivePublicTheme, getThemeTemplate } from "@/themes/public-theme";
import { renderThemeTemplate } from "@/themes/template-renderer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const [site, theme] = await Promise.all([
    getSiteSettings(),
    getActivePublicTheme(),
  ]);
  const template = getThemeTemplate(theme, "search");
  const page = Math.max(1, Number(pageParam ?? 1));
  const limit = site.postsPerPage;

  const result = query
    ? await services.content.queryPosts({
        postType: "post",
        status: "publish",
        search: query,
        orderBy: "date",
        order: "desc",
        limit,
        offset: (page - 1) * limit,
      })
    : { posts: [], total: 0 };
  const resultsHeader = query
    ? await renderThemeTemplate(theme, "archive", {
        siteTitle: site.title,
        queryTitle: `Results for "${query}"`,
        queryDescription: `${result.total} result${result.total === 1 ? "" : "s"}`,
      })
    : null;

  return (
    <div className="space-y-8">
      <form
        action="/search"
        method="GET"
        className={
          template.frame === "card"
            ? "rounded-[1.8rem] border border-border bg-surface px-6 py-7"
            : "border-b border-border pb-6"
        }
      >
        <label htmlFor="q" className="font-serif text-3xl font-bold">
          Search
        </label>
        <div className="mt-4 flex gap-2">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Search posts…"
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-5 py-2.5 font-medium text-background"
          >
            Search
          </button>
        </div>
      </form>

      {query ? (
        <ArchiveList
          title={`Results for “${query}”`}
          description={`${result.total} result${result.total === 1 ? "" : "s"}`}
          headerContent={resultsHeader}
          posts={await toPostCards(result.posts)}
          theme={theme}
          frame={template.frame}
          cardStyle={template.cardStyle ?? "minimal"}
          page={page}
          totalPages={Math.max(1, Math.ceil(result.total / limit))}
          basePath="/search"
          extraQuery={{ q: query }}
          emptyMessage="No posts matched your search."
        />
      ) : (
        <p className="text-muted">Enter a search term above to find posts.</p>
      )}
    </div>
  );
}
