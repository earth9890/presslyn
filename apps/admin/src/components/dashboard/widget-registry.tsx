import Link from "next/link";
import {
  Activity02Icon,
  ArrowRight01Icon,
  Comment01Icon,
  File02Icon,
  FolderShared01Icon,
  Home09Icon,
  Notification03Icon,
} from "hugeicons-react";
import { QuickDraftWidget } from "./quick-draft-widget";

export interface DashboardPostSummary {
  id: number;
  title: string;
  status: string;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface DashboardCommentSummary {
  id: number;
  postId: number;
  authorName: string;
  content: string;
  approved: boolean;
  createdAt: Date;
}

export interface DashboardWidgetContext {
  siteTitle: string;
  counts: {
    posts: number;
    pages: number;
    comments: number;
    pendingComments: number;
  };
  recentPosts: DashboardPostSummary[];
  recentComments: DashboardCommentSummary[];
  isFreshInstall: boolean;
}

export type DashboardWidgetArea = "hero" | "main" | "side";

export interface DashboardWidget {
  id: string;
  area: DashboardWidgetArea;
  order: number;
  render: (
    context: DashboardWidgetContext
  ) => React.ReactNode | Promise<React.ReactNode>;
}

const widgetRegistry = new Map<string, DashboardWidget>();
let defaultsRegistered = false;

export function registerDashboardWidget(widget: DashboardWidget) {
  widgetRegistry.set(widget.id, widget);
}

export function getDashboardWidgets(area: DashboardWidgetArea) {
  return [...widgetRegistry.values()]
    .filter((widget) => widget.area === area)
    .sort((left, right) => left.order - right.order);
}

export function registerDefaultDashboardWidgets() {
  if (defaultsRegistered) {
    return;
  }

  defaultsRegistered = true;

  registerDashboardWidget({
    id: "welcome",
    area: "hero",
    order: 10,
    render: (context) =>
      context.isFreshInstall ? <WelcomeWidget siteTitle={context.siteTitle} /> : null,
  });

  registerDashboardWidget({
    id: "snapshot",
    area: "main",
    order: 20,
    render: (context) => <SnapshotWidget context={context} />,
  });

  registerDashboardWidget({
    id: "activity",
    area: "main",
    order: 30,
    render: (context) => <ActivityWidget context={context} />,
  });

  registerDashboardWidget({
    id: "quick-draft",
    area: "side",
    order: 20,
    render: (context) => <QuickDraftWidget siteTitle={context.siteTitle} />,
  });
}

function WelcomeWidget({ siteTitle }: { siteTitle: string }) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-surface px-6 py-6 shadow-[0_22px_52px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            <Home09Icon size={14} />
            Fresh install
          </div>
          <h2 className="text-2xl font-semibold text-text-primary">
            Welcome to {siteTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            The shell is in place. Use the dashboard to seed content, review settings,
            and build the publishing rhythm that will define this install.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DashboardActionLink
            href="/posts"
            title="Open posts"
            body="Review drafts and published entries."
          />
          <DashboardActionLink
            href="/pages"
            title="Shape key pages"
            body="Set up the core pages your site needs."
          />
          <DashboardActionLink
            href="/comments"
            title="Prepare moderation"
            body="Keep an eye on the conversation queue."
          />
          <DashboardActionLink
            href="/settings"
            title="Tune the basics"
            body="Check title, URL, email, and reading settings."
          />
        </div>
      </div>
    </section>
  );
}

function DashboardActionLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[1.2rem] border border-border bg-surface-raised px-4 py-4 transition-colors hover:border-accent/30 hover:bg-accent-soft/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-sm text-text-secondary">{body}</p>
        </div>
        <ArrowRight01Icon size={16} className="mt-0.5 text-accent" />
      </div>
    </Link>
  );
}

function SnapshotWidget({ context }: { context: DashboardWidgetContext }) {
  const stats = [
    {
      label: "Posts",
      value: context.counts.posts,
      href: "/posts",
      icon: File02Icon,
    },
    {
      label: "Pages",
      value: context.counts.pages,
      href: "/pages",
      icon: FolderShared01Icon,
    },
    {
      label: "Comments",
      value: context.counts.comments,
      href: "/comments",
      icon: Comment01Icon,
    },
    {
      label: "Needs review",
      value: context.counts.pendingComments,
      href: "/comments?filter=pending",
      icon: Notification03Icon,
    },
  ];

  return (
    <section className="rounded-[1.35rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Site Snapshot</h2>
          <p className="mt-1 text-sm text-text-secondary">
            A quick read on your current publishing surface.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-2 text-accent">
          <Activity02Icon size={18} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-[1.1rem] border border-border bg-surface-raised px-4 py-4 transition-colors hover:border-accent/25 hover:bg-accent-soft/35"
          >
            <div className="mb-4 flex items-center justify-between">
              <stat.icon size={18} className="text-accent" />
              <ArrowRight01Icon size={14} className="text-text-muted" />
            </div>
            <div className="text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {stat.value}
            </div>
            <div className="mt-1 text-sm text-text-secondary">{stat.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ActivityWidget({ context }: { context: DashboardWidgetContext }) {
  return (
    <section className="rounded-[1.35rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Activity Stream</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Recent publishing movement and the latest audience signals.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-2 text-accent">
          <Activity02Icon size={18} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text-primary">Recent posts</h3>
            <Link href="/posts" className="text-xs font-medium text-accent hover:underline">
              View all
            </Link>
          </div>
          {context.recentPosts.length === 0 ? (
            <EmptyState body="No posts yet. Your next draft will show up here." />
          ) : (
            <div className="space-y-2.5">
              {context.recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href="/posts"
                  className="flex items-start justify-between gap-3 rounded-[1rem] border border-border bg-surface-raised px-4 py-3 transition-colors hover:border-accent/25 hover:bg-accent-soft/35"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {post.title || "Untitled draft"}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {humanizeStatus(post.status)} · {formatDate(post.publishedAt ?? post.createdAt)}
                    </p>
                  </div>
                  <StatusPill tone={post.status === "publish" ? "neutral" : "accent"}>
                    {humanizeStatus(post.status)}
                  </StatusPill>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text-primary">Latest comments</h3>
            <Link href="/comments" className="text-xs font-medium text-accent hover:underline">
              Open queue
            </Link>
          </div>
          {context.recentComments.length === 0 ? (
            <EmptyState body="No comments yet. Conversation activity will land here." />
          ) : (
            <div className="space-y-2.5">
              {context.recentComments.map((comment) => (
                <Link
                  key={comment.id}
                  href="/comments"
                  className="flex items-start justify-between gap-3 rounded-[1rem] border border-border bg-surface-raised px-4 py-3 transition-colors hover:border-accent/25 hover:bg-accent-soft/35"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {comment.authorName || "Anonymous"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
                      {comment.content}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {formatDate(comment.createdAt)}
                    </p>
                  </div>
                  <StatusPill tone={comment.approved ? "neutral" : "warning"}>
                    {comment.approved ? "Approved" : "Pending"}
                  </StatusPill>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ body }: { body: string }) {
  return (
    <div className="rounded-[1rem] border border-dashed border-border bg-surface-raised px-4 py-5 text-sm text-text-secondary">
      {body}
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "accent" | "warning";
}) {
  const toneClasses = {
    neutral: "border-border bg-surface text-text-secondary",
    accent: "border-accent/15 bg-accent-soft text-accent",
    warning: "border-warning/20 bg-warning/10 text-warning",
  } as const;

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function humanizeStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
