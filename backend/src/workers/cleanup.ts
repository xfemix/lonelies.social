import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Delete posts resolved more than 24h ago
async function run() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const deleted = await prisma.post.deleteMany({ where: { resolvedAt: { lt: cutoff } } });
  // eslint-disable-next-line no-console
  console.log(`cleanup: deleted ${deleted.count} resolved posts`);
}

run().finally(() => prisma.$disconnect());
