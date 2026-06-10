"use client";

import { useEffect, useState } from "react";
import { ContentEditorForm, type EditorTag } from "./content-editor-form";
import { getSessionToken } from "@/lib/api-client";

interface ParentOption {
  id: number;
  title: string;
}

interface TaxonomyTerm {
  id: number;
  taxonomyId: number;
  name: string;
  slug: string;
  taxonomySlug?: string | null;
}

interface RevisionSummary {
  id: number;
  title: string;
  excerpt: string;
  createdAt: string;
}

interface MediaRecord {
  id: number;
  title: string;
  filename: string;
  url: string;
  alt: string;
  mimeType: string;
}

interface EditorUser {
  id: number;
  displayName: string;
}

interface ContentEditorScreenProps {
  mode: "create" | "edit";
  postType: "post" | "page";
  postId?: number;
}

interface EditableContent {
  id: number;
  authorId: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: "draft" | "publish" | "pending" | "private";
  commentStatus: "open" | "closed";
  menuOrder: number;
  parentId: number | null;
  publishedAt: string | null;
  meta?: Record<string, unknown> | null;
}

interface TermsResponse {
  terms: TaxonomyTerm[];
}

interface MediaResponse {
  media: MediaRecord[];
}

export function ContentEditorScreen({
  mode,
  postType,
  postId,
}: ContentEditorScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState<EditableContent | null>(null);
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<TaxonomyTerm[]>([]);
  const [tagOptions, setTagOptions] = useState<TaxonomyTerm[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<EditorTag[]>([]);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [mediaOptions, setMediaOptions] = useState<MediaRecord[]>([]);
  const [authorName, setAuthorName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const token = getSessionToken();

        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const resourcePath = postType === "post" ? "posts" : "pages";
        const contentPromise =
          mode === "edit" && postId
            ? fetchJson<EditableContent>(
                `/api/v1/${resourcePath}/${postId}`,
                headers
              )
            : Promise.resolve(null);

        const revisionsPromise =
          mode === "edit" && postId
            ? fetchJson<RevisionSummary[]>(
                `/api/v1/${resourcePath}/${postId}/revisions`,
                headers
              )
            : Promise.resolve([]);

        const parentOptionsPromise =
          postType === "page"
            ? fetchJson<TermsResponse | { posts?: Array<{ id: number; title: string }> }>(
                "/api/v1/pages?status=publish,draft,pending,private&limit=100&orderBy=title&order=asc",
                headers
              )
            : Promise.resolve(null);

        const categoriesPromise =
          postType === "post"
            ? fetchJson<TermsResponse>(
                "/api/v1/taxonomies/category/terms?limit=100&orderBy=name&order=asc",
                headers
              )
            : Promise.resolve(null);

        const tagsPromise =
          postType === "post"
            ? fetchJson<TermsResponse>(
                "/api/v1/taxonomies/post_tag/terms?limit=100&orderBy=name&order=asc",
                headers
              )
            : Promise.resolve(null);

        const assignedTermsPromise =
          postType === "post" && mode === "edit" && postId
            ? fetchJson<TaxonomyTerm[]>(
                `/api/v1/${resourcePath}/${postId}/terms`,
                headers
              )
            : Promise.resolve([]);

        const mediaPromise = fetchJson<MediaResponse>(
          "/api/v1/media?limit=40&orderBy=date&order=desc",
          headers
        );
        const currentUserPromise = fetchJson<EditorUser>(
          "/api/v1/auth/me",
          headers
        );

        const [
          loadedContent,
          loadedRevisions,
          loadedParentOptions,
          loadedCategories,
          loadedTags,
          loadedAssignedTerms,
          loadedMedia,
          currentUser,
        ] = await Promise.all([
          contentPromise,
          revisionsPromise,
          parentOptionsPromise,
          categoriesPromise,
          tagsPromise,
          assignedTermsPromise,
          mediaPromise,
          currentUserPromise,
        ]);

        if (cancelled) {
          return;
        }

        if (loadedContent) {
          setContent(loadedContent);
        }

        setRevisions(loadedRevisions);
        setMediaOptions(
          loadedMedia.media.filter((item) => item.mimeType.startsWith("image/"))
        );
        setAuthorName(currentUser.displayName);

        if (postType === "page" && loadedParentOptions && "posts" in loadedParentOptions) {
          setParentOptions(
            (loadedParentOptions.posts ?? [])
              .filter((page) => (mode === "edit" && postId ? page.id !== postId : true))
              .map((page) => ({
                id: page.id,
                title: page.title || "(no title)",
              }))
          );
        }

        if (postType === "post") {
          const nextCategoryOptions = loadedCategories?.terms ?? [];
          const nextTagOptions = loadedTags?.terms ?? [];
          setCategoryOptions(nextCategoryOptions);
          setTagOptions(nextTagOptions);
          setSelectedCategoryIds(
            loadedAssignedTerms
              .filter((term) => term.taxonomySlug === "category")
              .map((term) => term.id)
          );
          setSelectedTags(
            loadedAssignedTerms
              .filter((term) => term.taxonomySlug === "post_tag")
              .map((term) => ({
                id: term.id,
                name: term.name,
                slug: term.slug,
              }))
          );
        }

        if (loadedContent && loadedContent.authorId !== currentUser.id) {
          try {
            const author = await fetchJson<EditorUser>(
              `/api/v1/users/${loadedContent.authorId}`,
              headers
            );
            if (!cancelled) {
              setAuthorName(author.displayName);
            }
          } catch {
            // Fall back to the current authenticated user label.
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the editor."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [mode, postId, postType]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl rounded-[1.4rem] border border-border bg-surface p-8 text-sm text-text-secondary shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        Loading editor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl rounded-[1.4rem] border border-danger/15 bg-danger/5 p-8 text-sm text-danger shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        {error}
      </div>
    );
  }

  return (
    <ContentEditorForm
      mode={mode}
      postType={postType}
      postId={postId}
      parentOptions={parentOptions}
      categoryOptions={categoryOptions.map((term) => ({
        id: term.id,
        name: term.name,
      }))}
      tagOptions={tagOptions.map((term) => ({
        id: term.id,
        name: term.name,
        slug: term.slug,
      }))}
      revisions={revisions}
      mediaOptions={mediaOptions}
      authorName={authorName}
      initialValues={{
        title: content?.title ?? "",
        slug: content?.slug ?? "",
        content: content?.content ?? "",
        excerpt: content?.excerpt ?? "",
        status: content?.status ?? "draft",
        commentStatus: content?.commentStatus ?? "open",
        menuOrder: content?.menuOrder ?? 0,
        parentId: content?.parentId ?? "",
        publishedAt: content?.publishedAt
          ? toDateTimeLocal(content.publishedAt)
          : "",
        categoryIds: selectedCategoryIds,
        tags: selectedTags,
        featuredMediaId:
          typeof content?.meta?.featuredMediaId === "number"
            ? content.meta.featuredMediaId
            : null,
        meta:
          content?.meta && typeof content.meta === "object"
            ? content.meta
            : {},
      }}
    />
  );
}

async function fetchJson<T>(
  input: string,
  headers?: Record<string, string>
): Promise<T> {
  const response = await fetch(input, { headers });
  const data = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      data && typeof data === "object" && "error" in data && data.error
        ? data.error
        : "Request failed."
    );
  }

  return data as T;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
