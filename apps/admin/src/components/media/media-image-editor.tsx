"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  RotateRight01Icon,
  RotateLeft01Icon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  CropIcon,
} from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type EditOps = {
  rotate?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  crop?: { left: number; top: number; width: number; height: number };
};

/**
 * In-browser rotate / flip / crop for an image media item. Rotate and flip
 * apply immediately; crop opens a drag-select overlay. All edits POST to
 * /media/:id/edit, which overwrites the original and regenerates thumbnails.
 */
export function MediaImageEditor({
  mediaId,
  url,
  alt,
}: {
  mediaId: number;
  url: string;
  alt: string;
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Cache-buster: the URL is stable across edits, so bump it to force reload.
  const [version, setVersion] = useState(0);
  const [cropping, setCropping] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const src = version === 0 ? url : `${url}?v=${version}`;

  async function applyEdit(ops: EditOps) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/media/${mediaId}/edit`, {
        method: "POST",
        body: ops,
      });
      setVersion(Date.now());
      setRect(null);
      setCropping(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not edit image.");
    } finally {
      setBusy(false);
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!cropping || busy) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    dragStart.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
    setRect({ x: dragStart.current.x, y: dragStart.current.y, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!cropping || !dragStart.current) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const cx = Math.max(0, Math.min(e.clientX - bounds.left, bounds.width));
    const cy = Math.max(0, Math.min(e.clientY - bounds.top, bounds.height));
    const { x, y } = dragStart.current;
    setRect({
      x: Math.min(x, cx),
      y: Math.min(y, cy),
      w: Math.abs(cx - x),
      h: Math.abs(cy - y),
    });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    dragStart.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function onPointerCancel(e: PointerEvent<HTMLDivElement>) {
    // Interrupted drag (touch cancel, context menu): reset cleanly.
    dragStart.current = null;
    setRect(null);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function applyCrop() {
    const img = imgRef.current;
    if (!img || !rect || rect.w < 4 || rect.h < 4) {
      setError("Drag a crop region on the image first.");
      return;
    }
    // Map the displayed rectangle to natural image pixels.
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    void applyEdit({
      crop: {
        left: Math.round(rect.x * scaleX),
        top: Math.round(rect.y * scaleY),
        width: Math.round(rect.w * scaleX),
        height: Math.round(rect.h * scaleY),
      },
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      {/* Center the image; the inner wrapper shrink-wraps the rendered image so
          pointer coordinates map 1:1 to it (no object-contain letterbox skew). */}
      <div className="flex justify-center rounded-md bg-surface-raised">
        <div
          className="relative inline-block"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{ cursor: cropping ? "crosshair" : "default", touchAction: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            className="block max-h-[60vh] max-w-full select-none"
          />
          {cropping && rect ? (
            <div
              className="pointer-events-none absolute border-2 border-accent bg-accent/10"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <EditButton
          onClick={() => applyEdit({ rotate: -90 })}
          disabled={busy || cropping}
          title="Rotate left"
        >
          <RotateLeft01Icon size={16} />
        </EditButton>
        <EditButton
          onClick={() => applyEdit({ rotate: 90 })}
          disabled={busy || cropping}
          title="Rotate right"
        >
          <RotateRight01Icon size={16} />
        </EditButton>
        <EditButton
          onClick={() => applyEdit({ flipHorizontal: true })}
          disabled={busy || cropping}
          title="Flip horizontal"
        >
          <FlipHorizontalIcon size={16} />
        </EditButton>
        <EditButton
          onClick={() => applyEdit({ flipVertical: true })}
          disabled={busy || cropping}
          title="Flip vertical"
        >
          <FlipVerticalIcon size={16} />
        </EditButton>

        <span className="mx-1 h-5 w-px bg-border" />

        {cropping ? (
          <>
            <button
              type="button"
              onClick={applyCrop}
              disabled={busy}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? "Applying…" : "Apply crop"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCropping(false);
                setRect(null);
                setError("");
              }}
              disabled={busy}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        ) : (
          <EditButton
            onClick={() => {
              setCropping(true);
              setError("");
            }}
            disabled={busy}
            title="Crop"
          >
            <CropIcon size={16} />
            <span className="text-xs">Crop</span>
          </EditButton>
        )}
      </div>
      {cropping ? (
        <p className="text-xs text-text-muted">
          Drag a rectangle on the image, then click <strong>Apply crop</strong>.
        </p>
      ) : null}
    </div>
  );
}

function EditButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-text-secondary hover:bg-surface-raised disabled:opacity-50"
    >
      {children}
    </button>
  );
}
