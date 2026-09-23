import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

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
