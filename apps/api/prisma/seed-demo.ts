/* eslint-disable no-console */
/**
 * Demo content for client walkthroughs: one seller with an active plan and eight approved
 * products (SVG thumbnails + zip files uploaded to object storage), one buyer with a paid order.
 * Idempotent: re-running removes and recreates the demo accounts.
 *
 *   npm run db:seed:demo
 *
 * Logins: demo-seller@marketplace.local / Demo1234!  and  demo-buyer@marketplace.local / Demo1234!
 */
import {
  LedgerEntryStatus,
  LedgerEntryType,
  OrderStatus,
  PaymentMethod,
  PrismaClient,
  ProductStatus,
  Role,
  SubscriptionStatus,
  VendorStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { splitSale } from '@marketplace/shared';
import { createPrismaAdapter } from '../src/prisma/adapter';
import { StorageService } from '../src/modules/storage/storage.service';
import { buildZip } from './lib/zip';

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const storage = new StorageService();

const PASSWORD = 'Demo1234!';
const SELLER_EMAIL = 'demo-seller@marketplace.local';
const BUYER_EMAIL = 'demo-buyer@marketplace.local';

interface DemoProduct {
  title: string;
  category: string; // category slug
  priceCents: number;
  short: string;
  description: string;
  tags: string[];
  sales: number;
  colors: [string, string];
  daysAgo: number;
}

const PRODUCTS: DemoProduct[] = [
  {
    title: 'Social Media Template Pack',
    category: 'templates',
    priceCents: 1600,
    short: '120 editable Instagram, Facebook and LinkedIn templates for modern brands.',
    description:
      'A complete social media kit with 120 editable templates in PSD, AI and Figma formats. Includes story, post and carousel layouts, a color-system guide and free font recommendations.\n\nWhat is inside:\n- 60 feed posts\n- 40 stories\n- 20 carousels\n- Color and typography guide',
    tags: ['social', 'instagram', 'figma'],
    sales: 2312,
    colors: ['#6366f1', '#ec4899'],
    daysAgo: 120,
  },
  {
    title: 'Modern WordPress Business Theme',
    category: 'templates',
    priceCents: 2400,
    short: 'Fast, accessible WordPress theme with a drag-and-drop page builder.',
    description:
      'A lightweight business theme built for speed and accessibility. Ships with 12 demo layouts, WooCommerce support, dark mode and a one-click importer.\n\nRequirements: WordPress 6.x, PHP 8.1+.',
    tags: ['wordpress', 'theme', 'business'],
    sales: 1140,
    colors: ['#0ea5e9', '#6366f1'],
    daysAgo: 90,
  },
  {
    title: 'Photoshop Actions Bundle',
    category: 'graphics',
    priceCents: 1200,
    short: '250 one-click Photoshop actions for portrait, landscape and product photography.',
    description:
      'Professional-grade actions organised in 12 collections. Non-destructive, layer-based, compatible with Photoshop CC 2019 and newer.',
    tags: ['photoshop', 'actions', 'photography'],
    sales: 956,
    colors: ['#1d4ed8', '#22d3ee'],
    daysAgo: 200,
  },
  {
    title: 'Premium Stock Photo Pack',
    category: 'graphics',
    priceCents: 1400,
    short: '500 high-resolution royalty-free photos for web and print.',
    description:
      'Curated collection of 500 photos (6000 x 4000 px, JPEG) covering business, technology, lifestyle and nature. Commercial license included.',
    tags: ['photos', 'stock', 'royalty-free'],
    sales: 731,
    colors: ['#f97316', '#f43f5e'],
    daysAgo: 60,
  },
  {
    title: 'UI/UX Design Masterclass',
    category: 'online-courses',
    priceCents: 1900,
    short: '14 hours of video lessons taking you from wireframe to polished product.',
    description:
      'Learn research, wireframing, visual design, prototyping and handoff with real projects. Includes Figma source files, exercises and a certificate of completion.\n\nModules: 9 · Lessons: 84 · Duration: 14h 20m',
    tags: ['course', 'ui', 'ux', 'figma'],
    sales: 1820,
    colors: ['#8b5cf6', '#6366f1'],
    daysAgo: 45,
  },
  {
    title: 'Elementor Pro Addons',
    category: 'plugins',
    priceCents: 1700,
    short: '45 extra widgets and templates for the Elementor page builder.',
    description:
      'Adds pricing tables, advanced sliders, mega menus, forms and 200+ block templates to Elementor. Lifetime updates, one-click demo import.',
    tags: ['elementor', 'wordpress', 'plugin'],
    sales: 654,
    colors: ['#db2777', '#8b5cf6'],
    daysAgo: 30,
  },
  {
    title: 'Royalty Free Music & SFX',
    category: 'audio',
    priceCents: 1100,
    short: '300 tracks and 1,000 sound effects cleared for YouTube, podcasts and apps.',
    description:
      'WAV and MP3 files organised by mood and genre. Includes loops, stingers and full tracks. Unlimited commercial use, no attribution required.',
    tags: ['music', 'sfx', 'audio'],
    sales: 892,
    colors: ['#0f766e', '#22d3ee'],
    daysAgo: 15,
  },
  {
    title: 'E-Book Bundle: Business & Self Growth',
    category: 'e-books',
    priceCents: 1500,
    short: 'Ten practical e-books on productivity, negotiation and building a business.',
    description:
      'Ten titles in EPUB and PDF formats, over 1,200 pages in total. Read on any device. Includes worksheets and checklists.',
    tags: ['ebook', 'business', 'productivity'],
    sales: 1210,
    colors: ['#4f46e5', '#a78bfa'],
    daysAgo: 5,
  },
];

function thumbnailSvg(title: string, [c1, c2]: [string, string]) {
  const words = title.split(' ');
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="800" height="600" fill="#0b1220"/>
  <circle cx="650" cy="120" r="220" fill="url(#g)" opacity="0.35"/>
  <circle cx="120" cy="520" r="180" fill="url(#g)" opacity="0.25"/>
  <rect x="60" y="60" width="680" height="480" rx="28" fill="#111a2e" stroke="url(#g)" stroke-width="3"/>
  <text x="100" y="270" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff">${escapeXml(line1)}</text>
  <text x="100" y="330" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="700" fill="url(#g)">${escapeXml(line2)}</text>
  <text x="100" y="440" font-family="Inter, Arial, sans-serif" font-size="22" fill="#94a3b8">DigiMarket demo product</text>
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function removeExisting() {
  const users = await prisma.user.findMany({
    where: { email: { in: [SELLER_EMAIL, BUYER_EMAIL] } },
    select: { id: true },
  });
  if (users.length === 0) return;
  const ids = users.map((u) => u.id);
  const vendorIds = (
    await prisma.vendor.findMany({ where: { userId: { in: ids } }, select: { id: true } })
  ).map((v) => v.id);
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { vendorId: { in: vendorIds } } }),
    prisma.withdrawal.deleteMany({ where: { vendorId: { in: vendorIds } } }),
    prisma.download.deleteMany({ where: { userId: { in: ids } } }),
    prisma.orderItem.deleteMany({ where: { order: { buyerId: { in: ids } } } }),
    prisma.order.deleteMany({ where: { buyerId: { in: ids } } }),
    prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log('Removed previous demo accounts');
}

async function main() {
  await removeExisting();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const categories = await prisma.category.findMany();
  const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const fallbackCategory = categories[0]?.id;
  if (!fallbackCategory) throw new Error('Run the base seed first (npm run db:seed)');

  const plan =
    (await prisma.plan.findUnique({ where: { slug: 'pro' } })) ??
    (await prisma.plan.findFirstOrThrow({ where: { isActive: true } }));

  // ---- Seller ------------------------------------------------------------
  const sellerUser = await prisma.user.create({
    data: { email: SELLER_EMAIL, passwordHash, name: 'Creative Studio', role: Role.VENDOR },
  });
  const vendor = await prisma.vendor.create({
    data: {
      userId: sellerUser.id,
      storeName: 'Creative Studio',
      slug: 'creative-studio',
      description:
        'Templates, graphics and courses crafted by a small team of designers. Every product ships with lifetime updates and friendly support.',
      status: VendorStatus.ACTIVE,
      payoutDetails: {
        type: 'PIX',
        pixKey: 'creative@studio.com',
        holderName: 'Creative Studio LTDA',
        holderDocument: '12345678000199',
      },
    },
  });
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await prisma.subscription.create({
    data: {
      vendorId: vendor.id,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gatewaySubscriptionId: `demo_${vendor.id}`,
    },
  });
  console.log(`Seller ${SELLER_EMAIL} on plan ${plan.name}`);

  // ---- Products ----------------------------------------------------------
  const created = [];
  for (const p of PRODUCTS) {
    const slug = p.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const publishedAt = new Date(Date.now() - p.daysAgo * 86_400_000);
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: bySlug.get(p.category) ?? fallbackCategory,
        title: p.title,
        slug,
        shortDescription: p.short,
        description: p.description,
        priceCents: p.priceCents,
        tags: p.tags,
        version: '1.0.0',
        status: ProductStatus.APPROVED,
        salesCount: p.sales,
        submittedAt: publishedAt,
        reviewedAt: publishedAt,
        publishedAt,
        createdAt: publishedAt,
      },
    });

    const thumbKey = storage.productImageKey(vendor.id, product.id, 'thumbnail.svg');
    await storage.putObject(
      thumbKey,
      Buffer.from(thumbnailSvg(p.title, p.colors)),
      'image/svg+xml',
    );

    const readme = `${p.title}\n\nThank you for your purchase from Creative Studio on DigiMarket.\nThis is a demo package.\n`;
    const zip = buildZip([{ name: 'README.txt', data: Buffer.from(readme) }]);
    const fileKey = storage.productFileKey(vendor.id, product.id, `${slug}.zip`);
    await storage.putObject(fileKey, zip, 'application/zip');

    await prisma.product.update({ where: { id: product.id }, data: { thumbnailKey: thumbKey } });
    await prisma.productFile.create({
      data: {
        productId: product.id,
        storageKey: fileKey,
        fileName: `${slug}.zip`,
        sizeBytes: zip.length,
        mimeType: 'application/zip',
        isMain: true,
      },
    });
    created.push(product);
    console.log(`  + ${p.title}`);
  }

  // ---- Buyer with one paid order (2 items) -------------------------------
  const buyer = await prisma.user.create({
    data: { email: BUYER_EMAIL, passwordHash, name: 'Ana Souza', role: Role.BUYER },
  });
  const items = created.slice(0, 2);
  const subtotal = items.reduce((s, i) => s + i.priceCents, 0);
  const paidAt = new Date(Date.now() - 2 * 86_400_000);
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-${paidAt.toISOString().slice(0, 10).replace(/-/g, '')}-DEMO01`,
      buyerId: buyer.id,
      status: OrderStatus.PAID,
      subtotalCents: subtotal,
      totalCents: subtotal,
      paymentMethod: PaymentMethod.PIX,
      gatewayOrderId: `demo_or_${buyer.id}`,
      paidAt,
      createdAt: paidAt,
      items: {
        create: items.map((i) => {
          const { commissionCents, vendorNetCents } = splitSale(
            i.priceCents,
            plan.commissionRateBps,
          );
          return {
            productId: i.id,
            vendorId: vendor.id,
            planId: plan.id,
            productTitle: i.title,
            priceCents: i.priceCents,
            commissionRateBps: plan.commissionRateBps,
            commissionCents,
            vendorNetCents,
          };
        }),
      },
    },
    include: { items: true },
  });
  // One credit already available, one still in the hold period, so both balances show on the dashboard.
  for (const [idx, item] of order.items.entries()) {
    await prisma.ledgerEntry.create({
      data: {
        vendorId: vendor.id,
        type: LedgerEntryType.SALE_CREDIT,
        status: idx === 0 ? LedgerEntryStatus.AVAILABLE : LedgerEntryStatus.PENDING,
        amountCents: item.vendorNetCents,
        availableAt: new Date(Date.now() + (idx === 0 ? -1 : 5) * 86_400_000),
        orderItemId: item.id,
        description: `Sale: ${item.productTitle}`,
        createdAt: paidAt,
      },
    });
  }
  // Give the seller a realistic available balance on top of the two demo sales.
  await prisma.ledgerEntry.create({
    data: {
      vendorId: vendor.id,
      type: LedgerEntryType.ADJUSTMENT,
      status: LedgerEntryStatus.AVAILABLE,
      amountCents: 48_000,
      description: 'Opening balance (demo)',
    },
  });

  console.log(`Buyer ${BUYER_EMAIL} with paid order ${order.orderNumber}`);
  console.log(`Demo seed complete. Password for both accounts: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
