import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { slug: 'existential', name: 'Existential Loneliness', order: 1, description: 'Meaning crises, "what\'s the point?" discussions.' },
  { slug: 'social', name: 'Social Loneliness', order: 2, description: 'Social anxiety, isolation, no friends.' },
  { slug: 'romantic', name: 'Romantic Loneliness', order: 3, description: 'Dating struggles and relationship issues.' },
  { slug: 'intellectual', name: 'Intellectual Loneliness', order: 4, description: 'No one understands your thoughts/interests.' },
  { slug: 'creative', name: 'Creative Loneliness', order: 5, description: 'Misunderstood artists, writers, creators.' },
  { slug: 'professional', name: 'Professional Loneliness', order: 6, description: 'Career isolation, outsiders at work.' },
  { slug: 'family', name: 'Family Loneliness', order: 7, description: 'Estrangement, toxic dynamics.' },
  { slug: 'spiritual', name: 'Spiritual Loneliness', order: 8, description: 'Religious/spiritual disconnect.' },
  { slug: 'physical', name: 'Physical Loneliness', order: 9, description: 'Chronic illness, disability-driven isolation.' }
];

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: c,
      create: c
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
