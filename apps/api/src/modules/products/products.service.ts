import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, VendorStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify, slugWithSuffix } from '../../common/utils/slug';
import { paginate } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  AdminProductsQuery,
  CreateProductDto,
  PublicProductsQuery,
  UpdateProductDto,
  VendorProductsQuery,
} from './dto/product.dto';

/** Statuses that count against the plan's product limit. */
export const LISTED_STATUSES: ProductStatus[] = [ProductStatus.APPROVED, ProductStatus.PENDING_REVIEW];

const EDITABLE_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.REJECTED,
  ProductStatus.UNPUBLISHED,
  ProductStatus.APPROVED,
  ProductStatus.PENDING_REVIEW,
];

const publicCardSelect = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  priceCents: true,
  currency: true,
  thumbnailKey: true,
  salesCount: true,
  publishedAt: true,
  tags: true,
  category: { select: { id: true, name: true, slug: true } },
  vendor: { select: { id: true, storeName: true, slug: true } },
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  // =========================================================================
  // Vendor
  // =========================================================================

  async listForVendor(vendorId: string, query: VendorProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      vendorId,
      status: query.status,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { files: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const withUrls = await Promise.all(
      items.map(async ({ _count, ...p }) => ({
        ...p,
        fileCount: _count.files,
        thumbnailUrl: await this.storage.createMediaUrl(p.thumbnailKey),
      })),
    );
    return paginate(withUrls, total, query);
  }

  async getForVendor(vendorId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, vendorId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        files: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.withMediaUrls(product);
  }

  async create(vendorId: string, dto: CreateProductDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { status: true } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status === VendorStatus.SUSPENDED) throw new ForbiddenException('Vendor account is suspended');

    await this.assertCategory(dto.categoryId);

    const base = slugify(dto.title) || 'product';
    const data = {
      vendorId,
      categoryId: dto.categoryId,
      title: dto.title.trim(),
      shortDescription: dto.shortDescription.trim(),
      description: dto.description,
      priceCents: dto.priceCents,
      demoUrl: dto.demoUrl,
      version: dto.version,
      tags: this.normalizeTags(dto.tags),
      status: ProductStatus.DRAFT,
    };

    try {
      return await this.prisma.product.create({ data: { ...data, slug: base } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.product.create({ data: { ...data, slug: slugWithSuffix(dto.title) } });
      }
      throw err;
    }
  }

  async update(vendorId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.ownedProduct(vendorId, productId);
    if (!EDITABLE_STATUSES.includes(product.status)) {
      throw new BadRequestException(`Products in status ${product.status} cannot be edited`);
    }
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        title: dto.title?.trim(),
        categoryId: dto.categoryId,
        shortDescription: dto.shortDescription?.trim(),
        description: dto.description,
        priceCents: dto.priceCents,
        demoUrl: dto.demoUrl,
        version: dto.version,
        tags: dto.tags ? this.normalizeTags(dto.tags) : undefined,
      },
    });
  }

  /** Sends a product to admin review. Enforces subscription, plan limit and file presence. */
  async submit(vendorId: string, productId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, vendorId },
        include: { _count: { select: { files: true } } },
      });
      if (!product) throw new NotFoundException('Product not found');
      const submittable: ProductStatus[] = [ProductStatus.DRAFT, ProductStatus.REJECTED, ProductStatus.UNPUBLISHED];
      if (!submittable.includes(product.status)) {
        throw new BadRequestException(`Products in status ${product.status} cannot be submitted`);
      }
      if (product._count.files === 0) {
        throw new BadRequestException('Upload at least one downloadable file before submitting');
      }
      if (!product.thumbnailKey) {
        throw new BadRequestException('A thumbnail image is required before submitting');
      }

      const subscription = await this.subscriptions.requireEntitled(vendorId, tx);
      await this.assertWithinPlanLimit(vendorId, subscription.plan.maxProducts, tx);

      // A previously approved product that was unpublished by the vendor goes straight back online.
      const wasApproved = product.status === ProductStatus.UNPUBLISHED && product.publishedAt !== null;
      const updated = await tx.product.update({
        where: { id: productId },
        data: wasApproved
          ? { status: ProductStatus.APPROVED }
          : { status: ProductStatus.PENDING_REVIEW, submittedAt: new Date(), rejectionReason: null },
      });

      await this.audit.log(
        { actorId, action: wasApproved ? 'product.republish' : 'product.submit', entityType: 'Product', entityId: productId },
        tx,
      );
      return updated;
    }).then((updated) => {
      if (updated.status === ProductStatus.PENDING_REVIEW) {
        this.realtime.toAdmins('product.submitted', { productId, title: updated.title, vendorId });
      }
      return updated;
    });
  }

  async unpublish(vendorId: string, productId: string, actorId: string) {
    const product = await this.ownedProduct(vendorId, productId);
    if (product.status !== ProductStatus.APPROVED) {
      throw new BadRequestException('Only published products can be unpublished');
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.UNPUBLISHED },
    });
    await this.audit.log({ actorId, action: 'product.unpublish', entityType: 'Product', entityId: productId });
    return updated;
  }

  /** Products with sales are never deleted (buyers keep download rights); they are unpublished instead. */
  async remove(vendorId: string, productId: string, actorId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, vendorId },
      include: { files: true, _count: { select: { orderItems: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product._count.orderItems > 0) {
      throw new ConflictException('This product has sales and cannot be deleted; unpublish it instead');
    }

    await this.prisma.product.delete({ where: { id: productId } });
    const keys = [
      ...product.files.map((f) => f.storageKey),
      ...(product.thumbnailKey ? [product.thumbnailKey] : []),
      ...product.previewImageKeys,
    ];
    await Promise.all(keys.map((k) => this.storage.deleteObject(k)));
    await this.audit.log({ actorId, action: 'product.delete', entityType: 'Product', entityId: productId });
    return { success: true };
  }

  // =========================================================================
  // Admin
  // =========================================================================

  async listForAdmin(query: AdminProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      status: query.status,
      vendorId: query.vendorId,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { vendor: { storeName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: query.status === ProductStatus.PENDING_REVIEW ? { submittedAt: 'asc' } : { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          vendor: { select: { id: true, storeName: true, slug: true, status: true } },
          _count: { select: { files: true, orderItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const withUrls = await Promise.all(
      items.map(async ({ _count, ...p }) => ({
        ...p,
        fileCount: _count.files,
        salesCount: _count.orderItems,
        thumbnailUrl: await this.storage.createMediaUrl(p.thumbnailKey),
      })),
    );
    return paginate(withUrls, total, query);
  }

  async getForAdmin(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, storeName: true, slug: true, status: true, user: { select: { email: true } } } },
        reviewedBy: { select: { id: true, name: true } },
        files: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.withMediaUrls(product);
  }

  /** Admins can inspect the actual file before approving. */
  async adminFileDownloadUrl(productId: string, fileId: string) {
    const file = await this.prisma.productFile.findFirst({ where: { id: fileId, productId } });
    if (!file) throw new NotFoundException('File not found');
    return { url: await this.storage.createDownloadUrl(file.storageKey, file.fileName) };
  }

  async approve(productId: string, adminId: string) {
    const product = await this.requireProduct(productId);
    if (product.status !== ProductStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only products pending review can be approved');
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        status: ProductStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: adminId,
        publishedAt: product.publishedAt ?? new Date(),
        rejectionReason: null,
      },
    });
    await this.audit.log({ actorId: adminId, action: 'product.approve', entityType: 'Product', entityId: productId });
    this.notifyStatus(updated);
    return updated;
  }

  async reject(productId: string, adminId: string, reason: string) {
    const product = await this.requireProduct(productId);
    if (product.status !== ProductStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only products pending review can be rejected');
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.REJECTED, reviewedAt: new Date(), reviewedById: adminId, rejectionReason: reason },
    });
    await this.audit.log({
      actorId: adminId,
      action: 'product.reject',
      entityType: 'Product',
      entityId: productId,
      metadata: { reason },
    });
    this.notifyStatus(updated);
    return updated;
  }

  async block(productId: string, adminId: string, reason?: string) {
    const product = await this.requireProduct(productId);
    if (product.status === ProductStatus.BLOCKED) return product;
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.BLOCKED, rejectionReason: reason ?? product.rejectionReason },
    });
    await this.audit.log({
      actorId: adminId,
      action: 'product.block',
      entityType: 'Product',
      entityId: productId,
      metadata: { reason: reason ?? null },
    });
    this.notifyStatus(updated);
    return updated;
  }

  async unblock(productId: string, adminId: string) {
    const product = await this.requireProduct(productId);
    if (product.status !== ProductStatus.BLOCKED) throw new BadRequestException('Product is not blocked');
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { status: product.publishedAt ? ProductStatus.APPROVED : ProductStatus.DRAFT },
    });
    await this.audit.log({ actorId: adminId, action: 'product.unblock', entityType: 'Product', entityId: productId });
    this.notifyStatus(updated);
    return updated;
  }

  private notifyStatus(product: { id: string; vendorId: string; title: string; status: ProductStatus; rejectionReason: string | null }) {
    this.realtime.toVendor(product.vendorId, 'product.status', {
      productId: product.id,
      title: product.title,
      status: product.status,
      reason: product.rejectionReason,
    });
  }

  // =========================================================================
  // Public storefront
  // =========================================================================

  async listPublic(query: PublicProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.APPROVED,
      vendor: { status: VendorStatus.ACTIVE },
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.vendor ? { vendor: { slug: query.vendor, status: VendorStatus.ACTIVE } } : {}),
      ...(query.minPriceCents !== undefined || query.maxPriceCents !== undefined
        ? { priceCents: { gte: query.minPriceCents, lte: query.maxPriceCents } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { shortDescription: { contains: query.search, mode: 'insensitive' } },
              { tags: { has: query.search.toLowerCase() } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'popular'
        ? { salesCount: 'desc' }
        : query.sort === 'price_asc'
          ? { priceCents: 'asc' }
          : query.sort === 'price_desc'
            ? { priceCents: 'desc' }
            : { publishedAt: 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: publicCardSelect, orderBy, skip: query.skip, take: query.pageSize }),
      this.prisma.product.count({ where }),
    ]);
    const withUrls = await Promise.all(
      items.map(async ({ thumbnailKey, ...p }) => ({
        ...p,
        thumbnailUrl: await this.storage.createMediaUrl(thumbnailKey),
      })),
    );
    return paginate(withUrls, total, query);
  }

  async getPublicBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.APPROVED, vendor: { status: VendorStatus.ACTIVE } },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, storeName: true, slug: true, logoKey: true } },
        files: { select: { id: true, fileName: true, sizeBytes: true, mimeType: true, isMain: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const { thumbnailKey, previewImageKeys, vendor, ...rest } = product;
    return {
      ...rest,
      thumbnailUrl: await this.storage.createMediaUrl(thumbnailKey),
      previewImageUrls: await Promise.all(previewImageKeys.map((k) => this.storage.createMediaUrl(k))),
      vendor: { ...vendor, logoUrl: await this.storage.createMediaUrl(vendor.logoKey) },
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  async ownedProduct(vendorId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, vendorId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async requireProduct(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async assertCategory(categoryId: string) {
    const exists = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) throw new BadRequestException('Category does not exist');
  }

  private async assertWithinPlanLimit(vendorId: string, maxProducts: number | null, tx: Prisma.TransactionClient) {
    if (maxProducts === null) return;
    const listed = await tx.product.count({ where: { vendorId, status: { in: LISTED_STATUSES } } });
    if (listed >= maxProducts) {
      throw new ForbiddenException(
        `Your plan allows ${maxProducts} listed product(s). Upgrade your plan or unpublish another product.`,
      );
    }
  }

  private normalizeTags(tags?: string[]) {
    if (!tags) return [];
    return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }

  private async withMediaUrls<T extends { thumbnailKey: string | null; previewImageKeys: string[] }>(product: T) {
    return {
      ...product,
      thumbnailUrl: await this.storage.createMediaUrl(product.thumbnailKey),
      previewImageUrls: await Promise.all(product.previewImageKeys.map((k) => this.storage.createMediaUrl(k))),
    };
  }
}
