import { services } from "@/lib/services";
import { CommentsTable, type CommentRow } from "@/components/comments/comments-table";

export const dynamic = "force-dynamic";

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; perPage?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? "all";
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(params.perPage ?? 20)));
  const offset = (page - 1) * limit;

  const approved =
    filter === "approved" ? true : filter === "pending" ? false : undefined;

  const [result, counts] = await Promise.all([
    services.comments.queryComments({
      approved,
      orderBy: "date",
      order: "desc",
      limit,
      offset,
    }),
    services.comments.getCommentCounts(),
  ]);

  const comments: CommentRow[] = result.comments.map((comment) => ({
    id: comment.id,
    postId: comment.postId,
    authorName: comment.authorName,
    authorEmail: comment.authorEmail,
    content: comment.content,
    approved: comment.approved,
    createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <CommentsTable
        comments={comments}
        counts={counts}
        filter={filter}
        page={page}
        perPage={limit}
        total={result.total}
      />
    </div>
  );
}
