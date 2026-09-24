/* eslint-disable no-console */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SETTING_DEFAULTS } from '@marketplace/shared';
import { createPrismaAdapter } from '../src/prisma/adapter';

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  // ---- Settings defaults (only inserted when missing) ----
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {},
    });
  }

  // ---- Admin user ----
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: 'Platform Admin', role: Role.ADMIN, passwordHash },
    // An explicitly provided password always wins, so re-running the seed rotates the admin password.
    update: process.env.SEED_ADMIN_PASSWORD ? { passwordHash, status: 'ACTIVE' } : {},
  });

  // ---- Plans ----
  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      description: 'For new sellers getting started.',
      priceCents: 0,
      commissionRateBps: 3000,
      maxProducts: 5,
      withdrawalsPerWeek: 1,
      sortOrder: 1,
    },
    {
      slug: 'pro',
      name: 'Pro',
      description: 'Lower commission and more listings.',
      priceCents: 4990,
      commissionRateBps: 2000,
      maxProducts: 50,
      withdrawalsPerWeek: 1,
      sortOrder: 2,
    },
    {
      slug: 'business',
      name: 'Business',
      description: 'Unlimited listings and the lowest commission.',
      priceCents: 14990,
      commissionRateBps: 1000,
      maxProducts: null,
      withdrawalsPerWeek: 1,
      sortOrder: 3,
    },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({ where: { slug: plan.slug }, create: plan, update: plan });
  }

  // ---- Categories ----
  const categories = [
    'Software',
    'E-books',
    'Online Courses',
    'Templates',
    'Graphics',
    'Audio',
    'Plugins',
  ];
  for (const [i, name] of categories.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await prisma.category.upsert({
      where: { slug },
      create: { name, slug, sortOrder: i },
      update: { name, sortOrder: i },
    });
  }

  console.log(`Seed complete. Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
