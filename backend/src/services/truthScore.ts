import { PrismaClient, VoteTag } from '@prisma/client';

export async function recomputeTruthScore(prisma: PrismaClient, postId: string): Promise<void> {
  const counts = await prisma.vote.groupBy({
    by: ['tag'],
    where: { postId },
    _count: { _all: true }
  });
  const helpful = counts.find(c => c.tag === VoteTag.HELPFUL_TRUTH)?._count._all ?? 0;
  const cruel = counts.find(c => c.tag === VoteTag.JUST_CRUEL)?._count._all ?? 0;

  // Simple algorithm: score = helpful - 1.5 * cruel; clamp to [-999, 999]
  const scoreRaw = helpful - 1.5 * cruel;
  const score = Math.max(-999, Math.min(999, scoreRaw));

  await prisma.post.update({
    where: { id: postId },
    data: {
      helpfulTruthCount: helpful,
      justCruelCount: cruel,
      truthScore: score
    }
  });
}
