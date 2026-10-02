import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class UpsertReviewDto {
  @IsString()
  orderItemId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ReplyReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reply: string;
}

export class HideReviewDto {
  @IsBoolean()
  hidden: boolean;
}

export class AdminReviewsQuery extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : undefined))
  @IsBoolean()
  hidden?: boolean;
}
