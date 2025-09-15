import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'unhealthy' });
  }
});

import categoriesRouter from './routes/categories.js';
import postsRouter from './routes/posts.js';

app.use('/categories', categoriesRouter);
app.use('/posts', postsRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`lonelies backend listening on http://localhost:${port}`);
});
