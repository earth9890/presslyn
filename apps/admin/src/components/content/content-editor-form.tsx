"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpRight01Icon,
  Cancel01Icon,
  FloppyDiskIcon,
  ViewIcon,
} from "hugeicons-react";
import { RichTextEditor } from "./rich-text-editor";
import { getSessionToken } from "@/lib/api-client";

interface ParentOption {
  id: number;
  title: string;
}

interface CategoryOption {
  id: number;
  name: string;
}

interface TagOption {
  id: number;
  name: string;
  slug: string;
}

interface RevisionSummary {
  id: number;
  title: string;
  excerpt: string;
  createdAt: string;
}

interface MediaOption {
  id: number;
  title: string;
  filename: string;
  url: string;
  alt: string;
}

export interface EditorTag {
  id?: number;
  name: string;
  slug?: string;
}

interface ContentEditorFormProps {
  mode: "create" | "edit";
  postType: "post" | "page";
  postId?: number;
  parentOptions?: ParentOption[];
  categoryOptions?: CategoryOption[];
  tagOptions?: TagOption[];
  revisions?: RevisionSummary[];
  mediaOptions?: MediaOption[];
  authorName?: string;
  initialValues: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: "draft" | "publish" | "pending" | "private";
    commentStatus: "open" | "closed";
    menuOrder: number;
    parentId: number | "";
    publishedAt: string;
    categoryIds: number[];
    tags: EditorTag[];
    featuredMediaId: number | null;
    meta: Record<string, unknown>;
  };
}

export function ContentEditorForm({
  mode,
  postType,
  postId,
  parentOptions = [],
  categoryOptions = [],
  tagOptions: initialTagOptions = [],
  revisions = [],
  mediaOptions = [],
  authorName,
  initialValues,
}: ContentEditorFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [tagOptions, setTagOptions] = useState(initialTagOptions);
  const [tagQuery, setTagQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [autosaveState, setAutosaveState] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  const lastPersistedSnapshot = useRef(serializeEditorState(initialValues));
  // True while any save (manual or autosave) is mid-flight, so the two paths
  // can never overlap and clobber each other with racing PUTs.
  const persistInFlight = useRef(false);

  const collectionPath = postType === "post" ? "/posts" : "/pages";
  const previewHref =
    mode === "edit" && postId
      ? postType === "post"
        ? `/preview/posts/${postId}`
        : `/preview/pages/${postId}`
      : null;
  const visibilityLabel =
    values.status === "private"
      ? "Private"
      : values.status === "publish"
        ? "Public"
        : values.status === "pending"
          ? "Pending review"
          : "Draft";
  const normalizedTagQuery = normalizeTagName(tagQuery);
  const selectedTagNames = new Set(values.tags.map((tag) => normalizeTagName(tag.name)));
  const suggestedTags = tagOptions
    .filter((option) => !selectedTagNames.has(normalizeTagName(option.name)))
    .filter((option) =>
      normalizedTagQuery
        ? normalizeTagName(option.name).includes(normalizedTagQuery)
        : true
    )
    .slice(0, normalizedTagQuery ? 6 : 5);
  const featuredMedia = mediaOptions.find(
    (item) => item.id === values.featuredMediaId
  );

  useEffect(() => {
    lastPersistedSnapshot.current = serializeEditorState(initialValues);
  }, [initialValues]);

  function updateValue<Key extends keyof typeof values>(
    key: Key,
    nextValue: (typeof values)[Key]
  ) {
    setValues((current) => ({ ...current, [key]: nextValue }));
    setSaved(false);
    setError("");
    if (mode === "edit") {
      setAutosaveState("pending");
    }
  }

  function toggleCategory(categoryId: number) {
    setValues((current) => {
      const categoryIds = current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((value) => value !== categoryId)
        : [...current.categoryIds, categoryId];

      return { ...current, categoryIds };
    });
    setSaved(false);
    setError("");
  }

  function addTag(rawName: string) {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name) {
      setTagQuery("");
      return;
    }

    setValues((current) => {
      if (current.tags.some((tag) => normalizeTagName(tag.name) === normalizeTagName(name))) {
        return current;
      }

      const matchedTag = tagOptions.find(
        (option) => normalizeTagName(option.name) === normalizeTagName(name)
      );

      return {
        ...current,
        tags: [
          ...current.tags,
          matchedTag
            ? { id: matchedTag.id, name: matchedTag.name, slug: matchedTag.slug }
            : { name },
        ],
      };
    });

    setTagQuery("");
    setSaved(false);
    setError("");
  }

  function removeTag(name: string) {
    updateValue(
      "tags",
      values.tags.filter((tag) => normalizeTagName(tag.name) !== normalizeTagName(name))
    );
  }

  function updateFeaturedMedia(mediaId: number | null) {
    setValues((current) => ({
      ...current,
      featuredMediaId: mediaId,
      meta: {
        ...current.meta,
        featuredMediaId: mediaId,
      },
    }));
    setSaved(false);
    setError("");
    if (mode === "edit") {
      setAutosaveState("pending");
    }
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagQuery);
      return;
    }

    if (event.key === "Backspace" && tagQuery.length === 0 && values.tags.length > 0) {
      event.preventDefault();
      removeTag(values.tags[values.tags.length - 1]!.name);
    }
  }

  async function persistContent(options?: {
    silent?: boolean;
    autosave?: boolean;
    redirectOnCreate?: boolean;
  }) {
    persistInFlight.current = true;
    try {
      // Auth rides on the HttpOnly session cookie (sent automatically with
      // same-origin requests); forward a legacy Bearer token only if present.
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const token = getSessionToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const payload = {
        title: values.title,
        slug: values.slug || undefined,
        content: values.content,
        excerpt: values.excerpt,
        status: values.status,
        commentStatus: values.commentStatus,
        menuOrder: values.menuOrder,
        meta: {
          ...values.meta,
          featuredMediaId: values.featuredMediaId,
        },
        ...(mode === "edit"
          ? { parentId: values.parentId === "" ? null : values.parentId }
          : values.parentId === ""
            ? {}
            : { parentId: values.parentId }),
        publishedAt: values.publishedAt
          ? new Date(values.publishedAt).toISOString()
          : undefined,
      };

      const response = await fetch(
        mode === "edit" && postId
          ? `/api/v1${collectionPath}/${postId}`
          : `/api/v1${collectionPath}`,
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json().catch(() => null)) as
        | { id?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to save content.");
      }

      const targetId = mode === "edit" ? postId : data?.id;

      if (postType === "post" && targetId) {
        await syncPostTerms(targetId, headers);
      }

      lastPersistedSnapshot.current = serializeEditorState(values);

      if (!options?.silent) {
        setSaved(true);
      }
      if (options?.autosave) {
        setAutosaveState("saved");
        setAutosavedAt(new Date().toISOString());
      }

      if (options?.redirectOnCreate !== false && mode === "create" && data?.id) {
        router.push(`${collectionPath}/${data.id}/edit`);
        router.refresh();
        return;
      }

      if (!options?.silent) {
        router.refresh();
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to save content.";
      setError(message);
      if (options?.autosave) {
        setAutosaveState("error");
      }
      throw new Error(message);
    } finally {
      persistInFlight.current = false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    setAutosaveState("idle");

    try {
      await persistContent();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (mode !== "edit" || !postId) {
      return;
    }

    const nextSnapshot = serializeEditorState(values);
    if (nextSnapshot === lastPersistedSnapshot.current) {
      if (autosaveState !== "saving") {
        setAutosaveState("idle");
      }
      return;
    }

    setAutosaveState("pending");

    const timeoutId = window.setTimeout(async () => {
      // Skip if a manual save (or a previous autosave) is still in flight.
      if (saving || persistInFlight.current) {
        return;
      }

      setAutosaveState("saving");
      try {
        await persistContent({
          silent: true,
          autosave: true,
          redirectOnCreate: false,
        });
      } catch {
        // Error state is already handled inside persistContent.
      }
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [mode, postId, saving, values]);

  // Warn before leaving with unsaved changes. Covers create mode (which has no
  // autosave) and the pre-debounce window in edit mode.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saving) return;
      if (serializeEditorState(values) !== lastPersistedSnapshot.current) {
        event.preventDefault();
        // Legacy browsers require returnValue to be set.
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [values, saving]);

  async function syncPostTerms(targetId: number, headers: Record<string, string>) {
    const resolvedTags = [...values.tags];
    const createdTags: TagOption[] = [];
    const termIds = [...values.categoryIds];

    for (const tag of values.tags) {
      if (tag.id) {
        termIds.push(tag.id);
        continue;
      }

      const existing = tagOptions.find(
        (option) => normalizeTagName(option.name) === normalizeTagName(tag.name)
      );

      if (existing) {
        termIds.push(existing.id);
        continue;
      }

      const response = await fetch("/api/v1/taxonomies/post_tag/terms", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: tag.name }),
      });

      const data = (await response.json().catch(() => null)) as
        | TagOption
        | { error?: string }
        | null;

      if (!response.ok || !data || !("id" in data)) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Content saved, but tags could not be updated."
        );
      }

      createdTags.push(data);
      termIds.push(data.id);
    }

    if (createdTags.length > 0) {
      const nextTagOptions = [...tagOptions, ...createdTags];
      setTagOptions(nextTagOptions);

      setValues((current) => ({
        ...current,
        tags: current.tags.map((tag) => {
          const createdTag = createdTags.find(
            (option) => normalizeTagName(option.name) === normalizeTagName(tag.name)
          );

          return createdTag
            ? { id: createdTag.id, name: createdTag.name, slug: createdTag.slug }
            : tag;
        }),
      }));
    } else if (resolvedTags.length > 0) {
      setValues((current) => ({
        ...current,
        tags: current.tags.map((tag) => {
          if (tag.id) {
            return tag;
          }

          const existing = tagOptions.find(
            (option) => normalizeTagName(option.name) === normalizeTagName(tag.name)
          );

          return existing
            ? { id: existing.id, name: existing.name, slug: existing.slug }
            : tag;
        }),
      }));
    }

    const assignmentResponse = await fetch(`/api/v1/posts/${targetId}/terms`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ termIds: Array.from(new Set(termIds)) }),
    });

    const assignment = (await assignmentResponse.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!assignmentResponse.ok) {
      throw new Error(
        assignment?.error ?? "Content saved, but terms could not be assigned."
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto grid max-w-[88rem] gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]"
    >
      <section className="space-y-5">
        {error ? (
          <div className="rounded-[1.05rem] border border-danger/15 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {saved ? (
          <div className="rounded-[1.05rem] border border-success/15 bg-success/5 px-4 py-3 text-sm text-success">
            {postType === "post" ? "Post" : "Page"} saved successfully.
          </div>
        ) : null}

        <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="space-y-3">
            <div>
              <label
                htmlFor="content-title"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted"
              >
                Title
              </label>
              <input
                id="content-title"
                value={values.title}
                onChange={(event) => updateValue("title", event.target.value)}
                placeholder={
                  postType === "post"
                    ? "Write a strong headline"
                    : "Name this page"
                }
                className="mt-2 w-full rounded-[1.15rem] border border-border bg-surface-raised px-4 py-3 text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>

            <div>
              <label
                htmlFor="content-slug"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted"
              >
                Slug
              </label>
              <div className="mt-2 flex items-center rounded-[1.05rem] border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-secondary">
                <span className="mr-2 shrink-0 text-text-muted">/</span>
                <input
                  id="content-slug"
                  value={values.slug}
                  onChange={(event) => updateValue("slug", event.target.value)}
                  placeholder="generated-from-title"
                  className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-muted"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Content
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                TipTap is now powering the primary writing surface while the
                broader Gutenberg-equivalent experience is still being built.
              </p>
            </div>
          </div>
          <RichTextEditor
            value={values.content}
            onChange={(nextValue) => updateValue("content", nextValue)}
            placeholder="Start writing..."
            mediaOptions={mediaOptions}
          />
        </section>

        <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <h2 className="text-base font-semibold text-text-primary">Excerpt</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Optional summary text used for cards, previews, and later SEO/meta
            surfaces.
          </p>
          <textarea
            id="content-excerpt"
            value={values.excerpt}
            onChange={(event) => updateValue("excerpt", event.target.value)}
            rows={5}
            placeholder="Summarize this entry in a few lines."
            className="mt-3 w-full resize-y rounded-[1.15rem] border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </section>
      </section>

      <aside className="space-y-5">
        <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Publish
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Control visibility and publish timing for this entry.
              </p>
            </div>
            {previewHref ? (
              <Link
                href={previewHref}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                <ViewIcon size={12} />
                Preview
              </Link>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Status" htmlFor="content-status">
              <select
                id="content-status"
                value={values.status}
                onChange={(event) =>
                  updateValue(
                    "status",
                    event.target.value as typeof initialValues.status
                  )
                }
                className={inputClass}
              >
                <option value="draft">Draft</option>
                <option value="publish">Published</option>
                <option value="pending">Pending Review</option>
                <option value="private">Private</option>
              </select>
            </Field>

            <Field label="Visibility" htmlFor="content-visibility">
              <input
                id="content-visibility"
                value={visibilityLabel}
                readOnly
                className={`${inputClass} text-text-secondary`}
              />
            </Field>

            <Field label="Author" htmlFor="content-author">
              <input
                id="content-author"
                value={authorName ?? "Loading author..."}
                readOnly
                className={`${inputClass} text-text-secondary`}
              />
            </Field>

            <Field label="Publish date" htmlFor="content-published-at">
              <input
                id="content-published-at"
                type="datetime-local"
                value={values.publishedAt}
                onChange={(event) => updateValue("publishedAt", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[1rem] bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FloppyDiskIcon size={14} />
              {saving
                ? "Saving..."
                : mode === "create"
                  ? `Create ${postType === "post" ? "Post" : "Page"}`
                  : "Save Changes"}
            </button>

            <Link
              href={collectionPath}
              className="inline-flex items-center gap-2 rounded-[1rem] border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Back to list
              <ArrowUpRight01Icon size={14} />
            </Link>
          </div>

          {mode === "edit" ? (
            <p className="mt-4 text-xs text-text-muted">
              {formatAutosaveStatus(autosaveState, autosavedAt)}
            </p>
          ) : null}
        </section>

        {postType === "post" ? (
          <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base font-semibold text-text-primary">
              Categories
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Assign this post to one or more categories.
            </p>

            <div className="mt-4 space-y-2">
              {categoryOptions.length > 0 ? (
                categoryOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-3 rounded-[1rem] border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={values.categoryIds.includes(option.id)}
                      onChange={() => toggleCategory(option.id)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <span>{option.name}</span>
                  </label>
                ))
              ) : (
                <p className="rounded-[1rem] border border-dashed border-border px-3 py-3 text-sm text-text-secondary">
                  No categories available yet.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {postType === "post" ? (
          <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base font-semibold text-text-primary">Tags</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Add tags with Enter or comma. Existing tags appear as suggestions.
            </p>

            <div className="mt-4 rounded-[1.15rem] border border-border bg-surface-raised px-3 py-3">
              <div className="flex flex-wrap gap-2">
                {values.tags.map((tag) => (
                  <button
                    key={tag.id ?? tag.name}
                    type="button"
                    onClick={() => removeTag(tag.name)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary"
                  >
                    {tag.name}
                    <span className="text-text-muted">x</span>
                  </button>
                ))}

                <input
                  value={tagQuery}
                  onChange={(event) => {
                    setTagQuery(event.target.value);
                    setSaved(false);
                    setError("");
                  }}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => {
                    if (tagQuery.trim()) {
                      addTag(tagQuery);
                    }
                  }}
                  placeholder={values.tags.length === 0 ? "Add a tag" : "Add another tag"}
                  className="min-w-[12rem] flex-1 bg-transparent py-1 text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
              </div>
            </div>

            {suggestedTags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestedTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      addTag(tag.name);
                    }}
                    className="rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Featured Image
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choose the primary visual used by cards, previews, and theme
                layouts.
              </p>
            </div>
            <Link
              href="/media"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              Media Library
            </Link>
          </div>

          {featuredMedia ? (
            <div className="mt-4 rounded-[1.2rem] border border-border bg-surface-raised p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredMedia.url}
                alt={featuredMedia.alt || featuredMedia.title || featuredMedia.filename}
                className="h-40 w-full rounded-[1rem] object-cover"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {featuredMedia.title || featuredMedia.filename}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {featuredMedia.alt || featuredMedia.filename}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateFeaturedMedia(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  <Cancel01Icon size={12} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-[1rem] border border-dashed border-border px-3 py-4 text-sm text-text-secondary">
              No featured image selected yet.
            </p>
          )}

          {mediaOptions.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {mediaOptions.slice(0, 9).map((item) => {
                const isSelected = item.id === values.featuredMediaId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Set featured image: ${item.title || item.filename}`}
                    onClick={() => updateFeaturedMedia(item.id)}
                    className={`overflow-hidden rounded-[1rem] border text-left transition-colors ${
                      isSelected
                        ? "border-accent ring-2 ring-accent/30"
                        : "border-border hover:border-accent/40"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.alt || item.title || item.filename}
                      className="h-20 w-full object-cover"
                    />
                    <div className="px-2 py-2">
                      <p className="truncate text-xs font-medium text-text-primary">
                        {item.title || item.filename}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[1rem] border border-dashed border-border px-3 py-4 text-sm text-text-secondary">
              No uploaded images are available yet. Add media first, then return
              here to assign one.
            </div>
          )}
        </section>

        <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <h2 className="text-base font-semibold text-text-primary">
            Discussion
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Keep comments open or close them at the document level.
          </p>

          <Field label="Comments" htmlFor="comment-status" className="mt-4">
            <select
              id="comment-status"
              value={values.commentStatus}
              onChange={(event) =>
                updateValue(
                  "commentStatus",
                  event.target.value as typeof initialValues.commentStatus
                )
              }
              className={inputClass}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </section>

        {postType === "page" ? (
          <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base font-semibold text-text-primary">
              Page Attributes
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Set hierarchy and ordering for navigational pages.
            </p>

            <div className="mt-4 space-y-4">
              <Field label="Parent" htmlFor="page-parent">
                <select
                  id="page-parent"
                  value={values.parentId}
                  onChange={(event) =>
                    updateValue(
                      "parentId",
                      event.target.value ? Number(event.target.value) : ""
                    )
                  }
                  className={inputClass}
                >
                  <option value="">None</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Order" htmlFor="page-order">
                <input
                  id="page-order"
                  type="number"
                  value={values.menuOrder}
                  onChange={(event) =>
                    updateValue("menuOrder", Number(event.target.value || 0))
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </section>
        ) : null}

        {mode === "edit" ? (
          <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <h2 className="text-base font-semibold text-text-primary">
              Revisions
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Each save creates a snapshot so editorial changes can be audited.
            </p>

            <div className="mt-4 space-y-3">
              {revisions.length > 0 ? (
                revisions.slice(0, 6).map((revision) => (
                  <div
                    key={revision.id}
                    className="rounded-[1rem] border border-border bg-surface-raised px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-text-primary">
                        {revision.title || "(no title)"}
                      </p>
                      <time
                        dateTime={revision.createdAt}
                        className="shrink-0 text-xs text-text-muted"
                      >
                        {formatRevisionDate(revision.createdAt)}
                      </time>
                    </div>
                    {revision.excerpt ? (
                      <p className="mt-1 text-sm text-text-secondary">
                        {revision.excerpt}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-[1rem] border border-dashed border-border px-3 py-3 text-sm text-text-secondary">
                  No revisions yet. The first save will create one.
                </p>
              )}
            </div>
          </section>
        ) : null}

        <section className="rounded-[1.4rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <h2 className="text-base font-semibold text-text-primary">
            Editor Status
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            This pass covers the working document form, slug editing, publish
            controls, taxonomy assignment, discussion settings, page hierarchy,
            revision history, featured image selection, and idle autosave. The
            block editor itself is still pending.
          </p>
        </section>
      </aside>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatRevisionDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAutosaveStatus(
  state: "idle" | "pending" | "saving" | "saved" | "error",
  autosavedAt: string | null
) {
  if (state === "saving") {
    return "Autosaving changes...";
  }

  if (state === "pending") {
    return "Changes detected. Autosave will run after a short pause.";
  }

  if (state === "saved" && autosavedAt) {
    return `Autosaved ${formatRelativeTime(autosavedAt)}.`;
  }

  if (state === "error") {
    return "Autosave failed. Use Save Changes to retry.";
  }

  return "Autosave is enabled for existing entries.";
}

function formatRelativeTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function serializeEditorState(state: {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  commentStatus: string;
  menuOrder: number;
  parentId: number | "";
  publishedAt: string;
  categoryIds: number[];
  tags: EditorTag[];
  featuredMediaId: number | null;
  meta: Record<string, unknown>;
}) {
  return JSON.stringify({
    ...state,
    categoryIds: [...state.categoryIds].sort((left, right) => left - right),
    // Compare tags by name only. id/slug are assigned server-side during
    // syncPostTerms; including them here would make the post-save state differ
    // from the pre-save snapshot and trigger an endless "phantom" autosave.
    tags: [...state.tags]
      .map((tag) => normalizeTagName(tag.name))
      .sort((left, right) => left.localeCompare(right)),
  });
}

const inputClass =
  "w-full rounded-[1rem] border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-accent";
