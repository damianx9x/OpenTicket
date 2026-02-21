import { IsString, IsOptional, IsBoolean, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'UUID ticketu' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({ description: 'UUID autora komentarza' })
  @IsOptional()
  @IsUUID()
  authorUserId?: string;

  @ApiPropertyOptional({ example: 'Sprawdziłem urządzenie — wymaga wymiany baterii.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @ApiPropertyOptional({ description: 'Legacy alias: autor tekstowy' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Legacy alias body' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @ApiPropertyOptional({ description: 'Czy komentarz jest wewnętrzny (niewidoczny dla klienta)', default: false })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
