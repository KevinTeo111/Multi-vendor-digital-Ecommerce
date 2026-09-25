import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  // Explicit types are required: implicit query-string conversion relies on the emitted
  // design:type metadata, which is `Object` for inferred initializers.
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  get skip() {
    return (this.page - 1) * this.pageSize;
  }
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, dto: PaginationDto): Paginated<T> {
  return {
    items,
    page: dto.page,
    pageSize: dto.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / dto.pageSize)),
  };
}

/** Runs the page query and the count concurrently and wraps the result. */
export async function findPage<T>(
  dto: PaginationDto,
  list: () => Promise<T[]>,
  count: () => Promise<number>,
): Promise<Paginated<T>> {
  const [items, total] = await Promise.all([list(), count()]);
  return paginate(items, total, dto);
}

/** Transforms every item of a page (for example to attach signed media URLs). */
export async function mapPage<T, U>(
  page: Paginated<T>,
  fn: (item: T) => Promise<U> | U,
): Promise<Paginated<U>> {
  return { ...page, items: await Promise.all(page.items.map(fn)) };
}
