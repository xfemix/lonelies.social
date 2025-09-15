import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  categoryId: z.string().uuid(),
  isAnonymous: z.boolean().optional().default(false),
  type: z.enum([
    'FIX_MY_LIFE',
    'AM_I_DELUSIONAL',
    'WHY_DO_PEOPLE_AVOID_ME',
    'RATE_MY_SITUATION',
    'EXISTENTIAL_CRISIS',
    'SOCIAL_AUTOPSY'
  ])
});

router.get('/', async (_req, res) => {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: { category: true }
  });
  res.json(posts);
});

router.post('/', async (req, res) => {
  // TODO: replace with real auth; use userId= null for anonymous
  const parse = createPostSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const data = parse.data;
  const post = await prisma.post.create({
    data: {
      title: data.title,
      content: data.content,
      type: data.type,
      isAnonymous: data.isAnonymous,
      categoryId: data.categoryId
    }
  });
  res.status(201).json(post);
});

export default router;
