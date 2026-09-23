import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus, VendorStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const cartItemInclude = {
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      priceCents: true,
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
      (i) => i.product.status === ProductStatus.APPROVED && i.product.vendor.status === VendorStatus.ACTIVE,
    );
    const stale = cart.items.filter((i) => !purchasable.includes(i));
    if (stale.length) {
      await this.prisma.cartItem.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
    }

    const items = await Promise.all(
      purchasable.map(async ({ product, ...item }) => {
        const { thumbnailKey, ...p } = product;
        return { ...item, product: { ...p, thumbnailUrl: await this.storage.createMediaUrl(thumbnailKey) } };
      }),
    );
    const subtotalCents = items.reduce((sum, i) => sum + i.product.priceCents, 0);
    return { id: cart.id, items, subtotalCents, removedUnavailable: stale.length };
  }

  async addItem(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, vendor: { select: { userId: true, status: true } } },
    });
    if (!product || product.status !== ProductStatus.APPROVED || product.vendor.status !== VendorStatus.ACTIVE) {
      throw new NotFoundException('Product is not available');
    }
    if (product.vendor.userId === userId) {
      throw new BadRequestException('You cannot buy your own product');
    }

    const alreadyOwned = await this.prisma.orderItem.findFirst({
      where: { productId, order: { buyerId: userId, status: OrderStatus.PAID } },
      select: { id: true },
    });
    if (alreadyOwned) throw new BadRequestException('You already own this product');

    const cart = await this.prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId },
      update: {},
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
