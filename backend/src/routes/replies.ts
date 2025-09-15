import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createReplySchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1),
  isAnonymous: z.boolean().optional().default(false)
});

router.get('/:postId', async (req, res) => {
  const { postId } = req.params;
  const replies = await prisma.reply.findMany({ where: { postId }, orderBy: { createdAt: 'asc' } });
  res.json(replies);
});

router.post('/', async (req, res) => {
  const parsed = createReplySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const reply = await prisma.reply.create({ data: parsed.data });
  res.status(201).json(reply);
});

export default router;
