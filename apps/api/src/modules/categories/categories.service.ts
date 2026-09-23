import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '../../common/utils/slug';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Flat list with product counts; the client can build the tree from parentId. */
  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { status: ProductStatus.APPROVED } } } } },
    });
    return categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async getById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) await this.getById(dto.parentId);
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug ?? slugify(dto.name),
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.getById(id);
    if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');
    if (dto.parentId) await this.getById(dto.parentId);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category._count.products > 0 || category._count.children > 0) {
      throw new BadRequestException('Category still has products or subcategories');
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }
}
