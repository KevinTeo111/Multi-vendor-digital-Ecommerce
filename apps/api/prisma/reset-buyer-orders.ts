/* eslint-disable no-console */
/**
 * Maintenance: removes every order of one buyer, plus what those orders produced
 * (items, downloads, sellers' ledger credits, product sales counters).
 *
 * Meant for test accounts in the sandbox phase. Orders are financial records, so there is no
 * such action in the UI or the API on purpose.
 *
 *   npm run db:reset-buyer-orders -- buyer@example.com          # dry run: prints what would go
 *   npm run db:reset-buyer-orders -- buyer@example.com --yes    # actually deletes
 */
import { OrderStatus, PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '../src/prisma/adapter';

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const [email, ...flags] = process.argv.slice(2);
  const confirmed = flags.includes('--yes');
  if (!email) throw new Error('Usage: reset-buyer-orders <buyer email> [--yes]');

  const buyer = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!buyer) throw new Error(`No user with e-mail ${email}`);

  const orders = await prisma.order.findMany({
    where: { buyerId: buyer.id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      items: { select: { id: true, productId: true, vendorId: true, vendorNetCents: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (orders.length === 0) {
    console.log(`${buyer.name} <${email}> has no orders. Nothing to do.`);
    return;
  }

  const itemIds = orders.flatMap((o) => o.items.map((i) => i.id));
  const [ledgerCount, downloadCount] = await Promise.all([
    prisma.ledgerEntry.count({ where: { orderItemId: { in: itemIds } } }),
    prisma.download.count({ where: { orderItemId: { in: itemIds } } }),
  ]);
  const creditsByVendor = new Map<string, number>();
  for (const order of orders.filter((o) => o.status === OrderStatus.PAID))
    for (const item of order.items)
      creditsByVendor.set(
        item.vendorId,
        (creditsByVendor.get(item.vendorId) ?? 0) + item.vendorNetCents,
      );

  console.log(`Buyer: ${buyer.name} <${email}>`);
  for (const o of orders)
    console.log(
      `  ${o.orderNumber}  ${o.status.padEnd(8)}  R$ ${(o.totalCents / 100).toFixed(2)}  ${o.items.length} item(s)`,
    );
  console.log(
    `Would delete: ${orders.length} orders, ${itemIds.length} items, ${downloadCount} downloads, ${ledgerCount} ledger entries.`,
  );
  for (const [vendorId, cents] of creditsByVendor)
    console.log(
      `  Seller ${vendorId} loses R$ ${(cents / 100).toFixed(2)} of sale credits (make sure they did not withdraw them).`,
    );

  if (!confirmed) {
    console.log('Dry run. Re-run with --yes to delete.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany({ where: { orderItemId: { in: itemIds } } });
    for (const order of orders.filter((o) => o.status === OrderStatus.PAID))
      for (const item of order.items)
        await tx.product.updateMany({
          where: { id: item.productId, salesCount: { gt: 0 } },
          data: { salesCount: { decrement: 1 } },
        });
    // Items and downloads cascade from the order.
    await tx.order.deleteMany({ where: { buyerId: buyer.id } });
  });
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
