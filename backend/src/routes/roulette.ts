import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Perspective Roulette: return a random high-variance sample of posts
router.get('/', async (_req, res) => {
  const posts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Post" ORDER BY RANDOM() * (ABS("truthScore") + 1) DESC LIMIT 10`
  );
  res.json(posts);
});

export default router;
