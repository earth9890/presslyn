import { notFound } from "next/navigation";
import Link from "next/link";
import { services } from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * Authenticated draft preview. Renders a post or page's current content —
 * including unpublished drafts — in a clean reading view. This route sits
 * outside the public web app and behind the admin session (the middleware
 * requires a session for any non-public path), so drafts never leak.
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) notFound();

  const expectedType = type === "pages" ? "page" : "post";

  let post;
  try {
    post = await services.content.getPostById(postId);
  } catch {
    notFound();
  }
  if (!post || post.postType !== expectedType) notFound();

  const statusLabel =
    post.status === "publish"
      ? "Published"
      : post.status.charAt(0).toUpperCase() + post.status.slice(1);

  const backHref =
    expectedType === "page" ? `/pages/${post.id}/edit` : `/posts/${post.id}/edit`;

  return (
    <div className="min-h-screen bg-surface-raised">
      {/* Preview banner */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-warning/10 px-4 py-2 text-sm">
        <span className="font-medium text-text-primary">
          Preview · <span className="text-text-secondary">{statusLabel}</span>
        </span>
        <Link href={backHref} className="font-medium text-accent hover:underline">
          ← Back to editor
        </Link>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-bold text-text-primary">{post.title}</h1>
        <div
          className="prose-content"
          dangerouslySetInnerHTML={{ __html: post.content ?? "" }}
        />
      </article>
    </div>
  );
}
