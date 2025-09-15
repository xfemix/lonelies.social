import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const bodySchema = z.object({ postId: z.string().uuid() });

router.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { postId } = parsed.data;
  const post = await prisma.post.update({ where: { id: postId }, data: { resolvedAt: new Date() } });
  res.json({ ok: true, post });
});

export default router;
