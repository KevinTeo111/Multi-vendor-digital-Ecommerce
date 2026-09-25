import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SETTING_KEYS } from '@marketplace/shared';
import { extname } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { ProductsService } from './products.service';
import {
  ConfirmFileDto,
  ConfirmImageDto,
  RequestImageUploadDto,
  RequestUploadDto,
} from './dto/product.dto';

const MAX_PREVIEW_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Two-step direct-to-storage uploads:
 *   1. request-url  -> presigned PUT the browser uploads to
 *   2. confirm      -> server verifies the object exists and records it
 * Nothing is trusted from the client until the object is verified with HEAD.
 */
@Injectable()
export class ProductFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly products: ProductsService,
  ) {}

  // ---- Downloadable files ------------------------------------------------

  async requestFileUpload(vendorId: string, productId: string, dto: RequestUploadDto) {
    await this.products.ownedProduct(vendorId, productId);

    const [maxMb, allowedExt] = await Promise.all([
      this.settings.get(SETTING_KEYS.MAX_UPLOAD_MB),
      this.settings.get(SETTING_KEYS.ALLOWED_FILE_EXTENSIONS),
    ]);
    const ext = extname(dto.fileName).replace('.', '').toLowerCase();
    if (!ext || !allowedExt.includes(ext)) {
      throw new BadRequestException(
        `File type .${ext || '?'} is not allowed. Allowed: ${allowedExt.join(', ')}`,
      );
    }
    if (dto.sizeBytes > maxMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds the maximum size of ${maxMb} MB`);
    }

    const key = this.storage.productFileKey(vendorId, productId, dto.fileName);
    return this.storage.createUploadUrl(key, dto.contentType || 'application/octet-stream');
  }

  async confirmFile(vendorId: string, productId: string, dto: ConfirmFileDto) {
    await this.products.ownedProduct(vendorId, productId);
    this.assertKeyBelongs(dto.storageKey, vendorId, productId, 'files');

    const info = await this.storage.headObject(dto.storageKey);
    if (!info)
      throw new BadRequestException('Upload not found in storage; please upload the file first');

    const maxMb = await this.settings.get(SETTING_KEYS.MAX_UPLOAD_MB);
    if (info.sizeBytes > maxMb * 1024 * 1024) {
      await this.storage.deleteObject(dto.storageKey);
      throw new BadRequestException(`File exceeds the maximum size of ${maxMb} MB`);
    }

    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.productFile.count({ where: { productId } });
      const isMain = dto.isMain ?? existingCount === 0;
      if (isMain) {
        await tx.productFile.updateMany({ where: { productId }, data: { isMain: false } });
      }
      return tx.productFile.create({
        data: {
          productId,
          storageKey: dto.storageKey,
          fileName: dto.fileName,
          sizeBytes: info.sizeBytes,
          mimeType: info.contentType ?? 'application/octet-stream',
          checksum: info.etag?.replace(/"/g, '') ?? null,
          isMain,
        },
      });
    });
  }

  async removeFile(vendorId: string, productId: string, fileId: string) {
    await this.products.ownedProduct(vendorId, productId);
    const file = await this.prisma.productFile.findFirst({ where: { id: fileId, productId } });
    if (!file) throw new NotFoundException('File not found');

    const sold = await this.prisma.orderItem.count({ where: { productId } });
    const remaining = await this.prisma.productFile.count({ where: { productId } });
    if (sold > 0 && remaining <= 1) {
      throw new BadRequestException(
        'A product with sales must keep at least one downloadable file',
      );
    }

    await this.prisma.productFile.delete({ where: { id: fileId } });
    await this.storage.deleteObject(file.storageKey);
    return { success: true };
  }

  // ---- Images ------------------------------------------------------------

  async requestImageUpload(vendorId: string, productId: string, dto: RequestImageUploadDto) {
    const product = await this.products.ownedProduct(vendorId, productId);
    if (dto.kind === 'preview' && product.previewImageKeys.length >= MAX_PREVIEW_IMAGES) {
      throw new BadRequestException(`At most ${MAX_PREVIEW_IMAGES} preview images are allowed`);
    }
    const key = this.storage.productImageKey(vendorId, productId, dto.fileName);
    return this.storage.createUploadUrl(key, dto.contentType);
  }

  async confirmImage(vendorId: string, productId: string, dto: ConfirmImageDto) {
    const product = await this.products.ownedProduct(vendorId, productId);
    this.assertKeyBelongs(dto.storageKey, vendorId, productId, 'images');

    const info = await this.storage.headObject(dto.storageKey);
    if (!info) throw new BadRequestException('Upload not found in storage');
    if (info.sizeBytes > MAX_IMAGE_BYTES || !info.contentType?.startsWith('image/')) {
      await this.storage.deleteObject(dto.storageKey);
      throw new BadRequestException('Images must be under 5 MB and have an image content type');
    }

    if (dto.kind === 'thumbnail') {
      const previous = product.thumbnailKey;
      const updated = await this.prisma.product.update({
        where: { id: productId },
        data: { thumbnailKey: dto.storageKey },
      });
      if (previous && previous !== dto.storageKey) await this.storage.deleteObject(previous);
      return { thumbnailUrl: await this.storage.createMediaUrl(updated.thumbnailKey) };
    }

    if (product.previewImageKeys.length >= MAX_PREVIEW_IMAGES) {
      await this.storage.deleteObject(dto.storageKey);
      throw new BadRequestException(`At most ${MAX_PREVIEW_IMAGES} preview images are allowed`);
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { previewImageKeys: { push: dto.storageKey } },
    });
    return {
      previewImageUrls: await Promise.all(
        updated.previewImageKeys.map((k) => this.storage.createMediaUrl(k)),
      ),
    };
  }

  async removeImage(vendorId: string, productId: string, storageKey: string) {
    const product = await this.products.ownedProduct(vendorId, productId);
    if (product.thumbnailKey === storageKey) {
      await this.prisma.product.update({ where: { id: productId }, data: { thumbnailKey: null } });
    } else if (product.previewImageKeys.includes(storageKey)) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { previewImageKeys: product.previewImageKeys.filter((k) => k !== storageKey) },
      });
    } else {
      throw new NotFoundException('Image not found on this product');
    }
    await this.storage.deleteObject(storageKey);
    return { success: true };
  }

  /** Guards against a vendor confirming a key that belongs to someone else's product. */
  private assertKeyBelongs(
    key: string,
    vendorId: string,
    productId: string,
    kind: 'files' | 'images',
  ) {
    const prefix = `vendors/${vendorId}/products/${productId}/${kind}/`;
    if (!key.startsWith(prefix) || key.includes('..')) {
      throw new BadRequestException('Invalid storage key for this product');
    }
  }
}
