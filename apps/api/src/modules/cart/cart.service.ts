import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseType, OrderStatus, Prisma, ProductStatus, VendorStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const cartItemInclude = {
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      priceCents: true,
      extendedPriceCents: true,
      currency: true,
      status: true,
      thumbnailKey: true,
      vendor: { select: { id: true, storeName: true, slug: true, status: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async get(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: { include: cartItemInclude, orderBy: { createdAt: 'asc' } } },
    });

    // Drop items that went offline since they were added.
    const purchasable = cart.items.filter(
      (i) =>
        i.product.status === ProductStatus.APPROVED &&
        i.product.vendor.status === VendorStatus.ACTIVE,
    );
    const stale = cart.items.filter((i) => !purchasable.includes(i));
    if (stale.length) {
      await this.prisma.cartItem.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
    }

    // An Extended licence the seller has since withdrawn falls back to Regular.
    const items = await Promise.all(
      purchasable.map(async ({ product, ...item }) => {
        const licenseType =
          item.licenseType === LicenseType.EXTENDED && product.extendedPriceCents !== null
            ? LicenseType.EXTENDED
            : LicenseType.REGULAR;
        return {
          ...item,
          licenseType,
          unitPriceCents:
            licenseType === LicenseType.EXTENDED ? product.extendedPriceCents! : product.priceCents,
          product: await this.storage.withThumbnail(product),
        };
      }),
    );
    const downgraded = items.filter((i, idx) => i.licenseType !== purchasable[idx].licenseType);
    if (downgraded.length)
      await this.prisma.cartItem.updateMany({
        where: { id: { in: downgraded.map((i) => i.id) } },
        data: { licenseType: LicenseType.REGULAR },
      });
    const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents, 0);
    return { id: cart.id, items, subtotalCents, removedUnavailable: stale.length };
  }

  /** Adds a product with the chosen licence; adding it again switches the licence. */
  async addItem(userId: string, productId: string, licenseType: LicenseType = LicenseType.REGULAR) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        status: true,
        extendedPriceCents: true,
        vendor: { select: { userId: true, status: true } },
      },
    });
    if (
      !product ||
      product.status !== ProductStatus.APPROVED ||
      product.vendor.status !== VendorStatus.ACTIVE
    ) {
      throw new NotFoundException('Product is not available');
    }
    if (product.vendor.userId === userId) {
      throw new BadRequestException('You cannot buy your own product');
    }
    if (licenseType === LicenseType.EXTENDED && product.extendedPriceCents === null) {
      throw new BadRequestException('This product has no extended licence');
    }

    const alreadyOwned = await this.prisma.orderItem.findFirst({
      where: { productId, order: { buyerId: userId, status: OrderStatus.PAID } },
      select: { id: true },
    });
    if (alreadyOwned) throw new BadRequestException('You already own this product');

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, licenseType },
      update: { licenseType },
    });
    return this.get(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    }
    return this.get(userId);
  }

  async clear(userId: string, tx: Prisma.TransactionClient = this.prisma) {
    const cart = await tx.cart.findUnique({ where: { userId } });
    if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}
