import { Router } from 'express';
import { PrismaClient, VoteTag } from '@prisma/client';
import { z } from 'zod';
import { recomputeTruthScore } from '../services/truthScore.js';

const router = Router();
const prisma = new PrismaClient();

const voteSchema = z.object({
  postId: z.string().uuid(),
  tag: z.nativeEnum(VoteTag)
});

router.post('/', async (req, res) => {
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { postId, tag } = parsed.data;
  await prisma.vote.create({ data: { postId, tag } });
  await recomputeTruthScore(prisma, postId);
  res.status(201).json({ ok: true });
});

export default router;
