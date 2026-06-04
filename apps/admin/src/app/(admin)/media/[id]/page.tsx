import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft01Icon } from "hugeicons-react";
import { services } from "@/lib/services";
import { MediaDetail, type MediaItem } from "@/components/media/media-detail";

export const dynamic = "force-dynamic";

export default async function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId) || mediaId < 1) notFound();

  let record;
  try {
    record = await services.media.getById(mediaId);
  } catch {
    notFound();
  }

  const media: MediaItem = {
    id: record.id,
    filename: record.filename,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    url: record.url,
    alt: record.alt,
    title: record.title,
    width: record.width,
    height: record.height,
    createdAt: record.createdAt
      ? new Date(record.createdAt).toISOString()
      : null,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link
        href="/media"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft01Icon size={16} />
        Back to Media Library
      </Link>
      <MediaDetail media={media} />
    </div>
  );
}
