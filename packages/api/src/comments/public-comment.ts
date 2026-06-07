import { z } from "zod";
import { CreateCommentSchema, ValidationError } from "@presslyn/core";

export const PublicCommentSubmissionSchema = CreateCommentSchema.extend({
  authorName: z.string().trim().min(1).max(255),
  authorEmail: z.string().email().max(255),
  website: z.string().max(255).optional(),
}).strict();

export type PublicCommentSubmission = z.infer<typeof PublicCommentSubmissionSchema>;

interface PublicCommentContentLookup {
  getPostById(id: number): Promise<{ status: string; commentStatus?: string | null }>;
}

interface PublicCommentParentLookup {
  getCommentById(id: number): Promise<{ postId: number }>;
}

export async function assertPublicCommentTarget(
  content: PublicCommentContentLookup,
  comments: PublicCommentParentLookup,
  input: Pick<PublicCommentSubmission, "postId" | "parentId" | "website">
): Promise<void> {
  if (input.website && input.website.trim().length > 0) {
    throw new ValidationError("Comment submission rejected");
  }

  const post = await content.getPostById(input.postId);
  if (post.status !== "publish") {
    throw new ValidationError("Comments can only be left on published content");
  }
  if (post.commentStatus !== "open") {
    throw new ValidationError("Comments are closed for this post");
  }

  if (!input.parentId) {
    return;
  }

  const parent = await comments.getCommentById(input.parentId);
  if (parent.postId !== input.postId) {
    throw new ValidationError("Parent comment does not belong to this post");
  }
}
