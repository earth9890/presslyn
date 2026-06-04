import { services } from "@/lib/services";

export interface ContentListFilters {
  status: string;
  search: string;
  page: number;
  perPage: number;
  categoryId?: number;
  archive?: string;
}

export interface ContentListRow {
  id: number;
  title: string;
  slug: string;
  status: string;
  authorName: string;
  authorId: number;
  commentsCount: number;
  categories: string[];
  tags: string[];
  dateLabel: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface ContentListCategoryOption {
  id: number;
  name: string;
  count: number;
}

export interface ContentListArchiveOption {
  value: string;
  label: string;
  count: number;
}

export interface ContentListScreenData {
  rows: ContentListRow[];
  total: number;
  limit: number;
  offset: number;
  status: string;
  search: string;
  page: number;
  perPage: number;
  categoryId?: number;
  archive?: string;
  counts: {
    all: number;
    publish: number;
    draft: number;
    pending: number;
    private: number;
    trash: number;
  };
  categoryOptions: ContentListCategoryOption[];
  archiveOptions: ContentListArchiveOption[];
}

export async function getContentListScreenData(
  postType: "post" | "page",
  filters: ContentListFilters
): Promise<ContentListScreenData> {
  const status = filters.status || "all";
  const search = filters.search || "";
  const page = Math.max(1, filters.page || 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage || 20));
  const offset = (page - 1) * perPage;
  const categoryId = filters.categoryId;
  const archive = filters.archive;
  const [year, month] = archive ? archive.split("-").map(Number) : [];

  const queryStatus =
    status === "all"
      ? ["publish", "draft", "pending", "private"]
      : status === "trash"
        ? ["trash"]
        : [status];

  const [result, statusCounts, categoryOptions, archiveOptions] =
    await Promise.all([
      services.content.queryPosts({
        postType,
        status: queryStatus,
        search: search || undefined,
        termId: postType === "post" ? categoryId : undefined,
        year: Number.isFinite(year) ? year : undefined,
        month: Number.isFinite(month) ? month : undefined,
        limit: perPage,
        offset,
        orderBy: "date",
        order: "desc",
      }),
      services.content.getStatusCounts(postType),
      postType === "post"
        ? services.taxonomy.getTermsWithCounts("category")
        : Promise.resolve([]),
      services.content.getArchiveOptions(postType),
    ]);

  const rows = await enrichContentRows(result.posts);

  return {
    rows,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    status,
    search,
    page,
    perPage,
    categoryId,
    archive,
    counts: {
      all:
        (statusCounts.publish ?? 0) +
        (statusCounts.draft ?? 0) +
        (statusCounts.pending ?? 0) +
        (statusCounts.private ?? 0),
      publish: statusCounts.publish ?? 0,
      draft: statusCounts.draft ?? 0,
      pending: statusCounts.pending ?? 0,
      private: statusCounts.private ?? 0,
      trash: statusCounts.trash ?? 0,
    },
    categoryOptions: categoryOptions.map((option) => ({
      id: option.id,
      name: option.name,
      count: option.count,
    })),
    archiveOptions,
  };
}

async function enrichContentRows(
  rawPosts: Awaited<ReturnType<typeof services.content.queryPosts>>["posts"]
) {
  if (rawPosts.length === 0) {
    return [];
  }

  const details = await services.content.getListDetails(
    rawPosts.map((post) => post.id)
  );

  return rawPosts.map((post) => {
    const taxonomyData = details.terms[post.id] ?? { categories: [], tags: [] };
    const dateValue = post.publishedAt ?? post.createdAt;

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      authorName: details.authors[post.id] ?? "Unknown author",
      authorId: post.authorId,
      commentsCount: details.comments[post.id] ?? 0,
      categories: taxonomyData.categories,
      tags: taxonomyData.tags,
      dateLabel: formatDate(dateValue),
      createdAt: post.createdAt.toISOString(),
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    };
  });
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
