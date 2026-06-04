import {
  getDashboardWidgets,
  registerDefaultDashboardWidgets,
  type DashboardWidgetArea,
  type DashboardWidgetContext,
} from "@/components/dashboard/widget-registry";
import { services } from "@/lib/services";

export const dynamic = "force-dynamic";

registerDefaultDashboardWidgets();

export default async function AdminDashboard() {
  const [postsResult, pagesResult, commentCounts, recentPosts, recentComments, siteTitle] =
    await Promise.all([
      services.content.queryPosts({
        postType: "post",
        status: ["publish", "draft", "pending", "private"],
        limit: 1,
      }),
      services.content.queryPosts({
        postType: "page",
        status: ["publish", "draft", "pending", "private"],
        limit: 1,
      }),
      services.comments.getCommentCounts(),
      services.content.queryPosts({
        postType: "post",
        status: ["publish", "draft", "pending", "private"],
        orderBy: "date",
        order: "desc",
        limit: 4,
      }),
      services.comments.queryComments({
        orderBy: "date",
        order: "desc",
        limit: 4,
      }),
      services.options.getOption("blogname").catch(() => "Presslyn"),
    ]);

  const context: DashboardWidgetContext = {
    siteTitle: String(siteTitle ?? "Presslyn"),
    counts: {
      posts: postsResult.total,
      pages: pagesResult.total,
      comments: commentCounts.total,
      pendingComments: commentCounts.pending,
    },
    recentPosts: recentPosts.posts,
    recentComments: recentComments.comments,
    isFreshInstall:
      postsResult.total <= 1 && pagesResult.total <= 1 && commentCounts.total === 0,
  };

  const heroWidgets = await renderWidgets("hero", context);
  const mainWidgets = await renderWidgets("main", context);
  const sideWidgets = await renderWidgets("side", context);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {heroWidgets.length > 0 ? (
        <section className="space-y-4">{heroWidgets}</section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
        <section className="space-y-6">{mainWidgets}</section>
        <aside className="space-y-6">{sideWidgets}</aside>
      </div>
    </div>
  );
}

async function renderWidgets(
  area: DashboardWidgetArea,
  context: DashboardWidgetContext
) {
  const widgets = getDashboardWidgets(area);

  return Promise.all(
    widgets.map(async (widget) => {
      const rendered = await widget.render(context);
      return rendered ? <section key={widget.id}>{rendered}</section> : null;
    })
  );
}
