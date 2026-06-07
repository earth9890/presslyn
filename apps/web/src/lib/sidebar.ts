import { services } from "@/lib/services";
import type { ContentScope } from "@presslyn/core";
import type { TaxonomyScope } from "@presslyn/core";

export interface SidebarPostLink {
  slug: string;
  title: string;
}

export interface SidebarCategoryLink {
  slug: string;
  name: string;
  count: number;
}

export interface SidebarTemplateData {
  recentPosts: SidebarPostLink[];
  categories: SidebarCategoryLink[];
}

export async function getSidebarTemplateData(
  scope?: ContentScope & TaxonomyScope
): Promise<SidebarTemplateData> {
  const [recentResult, categories] = await Promise.all([
    services.content.queryPosts({
      postType: "post",
      status: "publish",
      orderBy: "date",
      order: "desc",
      limit: 5,
      offset: 0,
    }, scope),
    services.taxonomy.getTermsWithCounts("category", scope).catch(() => []),
  ]);

  return {
    recentPosts: recentResult.posts.map((post) => ({
      slug: post.slug,
      title: post.title || "(untitled)",
    })),
    categories: categories
      .filter((category) => category.count > 0)
      .slice(0, 8)
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        count: category.count,
      })),
  };
}
