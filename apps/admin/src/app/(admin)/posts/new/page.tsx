import { ContentEditorScreen } from "@/components/content/content-editor-screen";

export const dynamic = "force-dynamic";

export default function NewPostPage() {
  return <ContentEditorScreen mode="create" postType="post" />;
}
