import Link from "next/link";
import { ArrowLeft01Icon } from "hugeicons-react";
import { MediaUploader } from "@/components/media/media-uploader";

export const dynamic = "force-dynamic";

export default function MediaUploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/media"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft01Icon size={16} />
        Back to Media Library
      </Link>
      <MediaUploader />
    </div>
  );
}
