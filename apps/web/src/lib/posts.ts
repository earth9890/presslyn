import { services } from "./services";
import { excerptFrom, isoDate } from "./site";
import type { PostCardData } from "@/components/post-card";

type RawPost = Awaited<
  ReturnType<typeof services.content.queryPosts>
>["posts"][number];

/**
 * Enrich raw posts with author names and category labels (one batched query)
 * and shape them into card data for listings. Uses each post's own excerpt
 * when present, otherwise derives one from the content.
 */
export async function toPostCards(posts: RawPost[]): Promise<PostCardData[]> {
  if (posts.length === 0) return [];

  const details = await services.content.getListDetails(posts.map((p) => p.id));

  return posts.map((post) => {
    const terms = details.terms[post.id] ?? { categories: [], tags: [] };
    return {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt?.trim()
        ? post.excerpt
        : excerptFrom(post.content),
      date: isoDate(post.publishedAt ?? post.createdAt),
      author: details.authors[post.id] ?? "",
      categories: terms.categories,
    };
  });
}
