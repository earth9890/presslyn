import { notFound } from "next/navigation";
import { ContentEditorScreen } from "@/components/content/content-editor-screen";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);

  if (!Number.isInteger(postId) || postId <= 0) {
    notFound();
  }

  return <ContentEditorScreen mode="edit" postType="post" postId={postId} />;
}
