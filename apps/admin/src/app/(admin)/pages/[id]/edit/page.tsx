import { notFound } from "next/navigation";
import { ContentEditorScreen } from "@/components/content/content-editor-screen";

export const dynamic = "force-dynamic";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pageId = Number(id);

  if (!Number.isInteger(pageId) || pageId <= 0) {
    notFound();
  }

  return <ContentEditorScreen mode="edit" postType="page" postId={pageId} />;
}
