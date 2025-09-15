import { Router } from 'express';
import { PrismaClient, FlagType } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const flagSchema = z.object({
  postId: z.string().uuid(),
  type: z.nativeEnum(FlagType),
  note: z.string().optional()
});

router.post('/', async (req, res) => {
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await prisma.flag.create({ data: parsed.data });
  res.status(201).json({ ok: true });
});

export default router;
