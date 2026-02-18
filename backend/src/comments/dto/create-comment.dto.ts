import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'UUID ticketu' })
  @IsUUID()
  ticketId: string;

  @ApiProperty({ description: 'UUID autora komentarza' })
  @IsUUID()
  authorUserId: string;

  @ApiProperty({ example: 'Sprawdziłem urządzenie — wymaga wymiany baterii.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  body: string;

  @ApiPropertyOptional({ description: 'Czy komentarz jest wewnętrzny (niewidoczny dla klienta)', default: false })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
