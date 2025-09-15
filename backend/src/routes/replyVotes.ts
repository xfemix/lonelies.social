import { Router } from 'express';
import { PrismaClient, VoteTag } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const schema = z.object({ replyId: z.string().uuid(), tag: z.nativeEnum(VoteTag) });

router.post('/', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await prisma.replyVote.create({ data: parsed.data });
  res.status(201).json({ ok: true });
});

export default router;
