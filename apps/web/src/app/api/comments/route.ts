import { NextResponse } from "next/server";
import {
  PublicCommentSubmissionSchema,
  assertPublicCommentTarget,
} from "@presslyn/api";
import { services } from "@/lib/services";
import { getResolvedSite } from "@/lib/site";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = PublicCommentSubmissionSchema.parse(body);
    const resolvedSite = await getResolvedSite();
    const siteScope = resolvedSite ? { siteId: resolvedSite.id } : undefined;

    await assertPublicCommentTarget(
      {
        getPostById: (id: number) => services.content.getPostById(id, siteScope),
      },
      {
        getCommentById: (id: number) => services.comments.getCommentById(id, siteScope),
      },
      validated
    );

    const { website: _website, ...commentInput } = validated;
    const comment = await services.comments.createComment(commentInput, siteScope);

    return NextResponse.json(
      {
        message: "Comment submitted and queued for moderation.",
        commentId: comment.id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Could not submit comment." },
      { status: 400 }
    );
  }
}
