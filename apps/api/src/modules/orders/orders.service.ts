import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { findPage, mapPage } from '../../common/dto/pagination.dto';
import { StorageService } from '../storage/storage.service';
import { AdminOrdersQuery, BuyerOrdersQuery, VendorSalesQuery } from './dto/order.dto';

const orderItemInclude = {
  product: { select: { id: true, slug: true, thumbnailKey: true, version: true } },
  vendor: { select: { id: true, storeName: true, slug: true } },
} satisfies Prisma.OrderItemInclude;

const insensitive = (value: string) => ({ contains: value, mode: 'insensitive' as const });

/** Read side of orders: buyer history and downloads, vendor sales, admin listings. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ---- Buyer ---------------------------------------------------------------

  async listForBuyer(buyerId: string, query: BuyerOrdersQuery) {
    const where: Prisma.OrderWhereInput = { buyerId, status: query.status };
    const page = await findPage(
      query,
      () =>
        this.prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: query.skip,
          take: query.pageSize,
          include: { items: { include: orderItemInclude } },
        }),
      () => this.prisma.order.count({ where }),
    );
    return mapPage(page, (o) => this.decorateOrder(o));
  }

  async getForBuyer(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
      include: {
        items: { include: { ...orderItemInclude, _count: { select: { downloads: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.decorateOrder(order);
  }

  /** Every product the buyer has paid for, for a "My downloads" page. */
  async libraryForBuyer(buyerId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { buyerId, status: OrderStatus.PAID } },
      orderBy: { createdAt: 'desc' },
      include: {
        ...orderItemInclude,
        order: { select: { id: true, orderNumber: true, paidAt: true } },
        product: {
          select: {
            id: true,
            slug: true,
            thumbnailKey: true,
            version: true,
            files: { select: { id: true, fileName: true, sizeBytes: true, isMain: true } },
          },
        },
      },
    });
    return Promise.all(
      items.map(async ({ product, ...item }) => ({
        ...item,
        product: await this.storage.withThumbnail(product),
      })),
    );
  }

  /** Issues a short-lived signed URL for one file of a paid order item and logs the download. */
  async downloadUrl(
    buyerId: string,
    orderItemId: string,
    fileId: string | undefined,
    meta: { ip?: string; userAgent?: string },
  ) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: { select: { buyerId: true, status: true } },
        product: { select: { files: true } },
      },
    });
    if (!item || item.order.buyerId !== buyerId)
      throw new NotFoundException('Order item not found');
    if (item.order.status !== OrderStatus.PAID)
      throw new ForbiddenException('This order has not been paid');

    const file = fileId
      ? item.product.files.find((f) => f.id === fileId)
      : (item.product.files.find((f) => f.isMain) ?? item.product.files[0]);
    if (!file) throw new NotFoundException('No downloadable file is attached to this product');

    const [url] = await Promise.all([
      this.storage.createDownloadUrl(file.storageKey, file.fileName),
      this.prisma.download.create({
        data: {
          orderItemId,
          userId: buyerId,
          ipAddress: meta.ip,
          userAgent: meta.userAgent?.slice(0, 500),
        },
      }),
    ]);
    return {
      url,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
      expiresInSeconds: env.DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  // ---- Vendor sales ---------------------------------------------------------

  async listSalesForVendor(vendorId: string, query: VendorSalesQuery) {
    const where: Prisma.OrderItemWhereInput = { vendorId, order: { status: OrderStatus.PAID } };
    const [page, totals] = await Promise.all([
      findPage(
        query,
        () =>
          this.prisma.orderItem.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: query.skip,
            take: query.pageSize,
            include: {
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  paidAt: true,
                  buyer: { select: { name: true } },
                },
              },
              product: { select: { id: true, slug: true } },
            },
          }),
        () => this.prisma.orderItem.count({ where }),
      ),
      this.prisma.orderItem.aggregate({
        where,
        _sum: { priceCents: true, commissionCents: true, vendorNetCents: true },
      }),
    ]);
    return {
      ...page,
      totals: {
        grossCents: totals._sum.priceCents ?? 0,
        commissionCents: totals._sum.commissionCents ?? 0,
        netCents: totals._sum.vendorNetCents ?? 0,
      },
    };
  }

  /** One sale as the vendor sees it: item, order, buyer name, payout status, downloads. */
  async getSaleForVendor(vendorId: string, orderItemId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: orderItemId, vendorId, order: { status: OrderStatus.PAID } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            paidAt: true,
            paymentMethod: true,
            currency: true,
            buyer: { select: { name: true } },
          },
        },
        product: {
          select: { id: true, slug: true, title: true, thumbnailKey: true, version: true },
        },
        plan: { select: { id: true, name: true } },
        ledgerEntries: {
          select: { id: true, type: true, status: true, amountCents: true, availableAt: true },
        },
        _count: { select: { downloads: true } },
      },
    });
    if (!item) throw new NotFoundException('Sale not found');
    const { product, _count, ...rest } = item;
    return {
      ...rest,
      downloads: _count.downloads,
      product: await this.storage.withThumbnail(product),
    };
  }

  // ---- Admin ----------------------------------------------------------------

  listForAdmin(query: AdminOrdersQuery) {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      buyerId: query.buyerId,
      ...(query.vendorId ? { items: { some: { vendorId: query.vendorId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: insensitive(query.search) },
              { buyer: { email: insensitive(query.search) } },
            ],
          }
        : {}),
    };
    return findPage(
      query,
      () =>
        this.prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: query.skip,
          take: query.pageSize,
          include: {
            buyer: { select: { id: true, name: true, email: true } },
            items: { include: orderItemInclude },
          },
        }),
      () => this.prisma.order.count({ where }),
    );
  }

  async getForAdmin(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            ...orderItemInclude,
            ledgerEntries: true,
            _count: { select: { downloads: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ---- Helpers --------------------------------------------------------------

  private async decorateOrder<
    T extends { items: Array<{ product: { thumbnailKey: string | null } }> },
  >(order: T) {
    const items = await Promise.all(
      order.items.map(async ({ product, ...item }) => ({
        ...item,
        product: await this.storage.withThumbnail(product),
      })),
    );
    return { ...order, items };
  }
}
