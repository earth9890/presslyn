import { ContentEditorScreen } from "@/components/content/content-editor-screen";

export const dynamic = "force-dynamic";

export default function NewPagePage() {
  return <ContentEditorScreen mode="create" postType="page" />;
}
