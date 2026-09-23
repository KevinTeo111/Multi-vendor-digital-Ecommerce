import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, digits and hyphens' })
  @MaxLength(80)
  slug?: string;

  @IsOptional() @IsString()
  parentId?: string | null;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(80)
  slug?: string;

  @IsOptional() @IsString()
  parentId?: string | null;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}
