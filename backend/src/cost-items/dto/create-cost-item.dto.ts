import { IsString, IsNotEmpty, IsUUID, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCostItemDto {
  @ApiProperty({ description: 'UUID ticketu' })
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @ApiPropertyOptional({ example: 'Wymiana baterii laptopa' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Ilość (szt, godz, etc.)' })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  qty?: number;

  @ApiPropertyOptional({ example: 150.00, description: 'Cena jednostkowa netto (PLN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitNet?: number;

  @ApiPropertyOptional({ example: '23', description: 'Kod stawki VAT (np. 23, 8, 5, 0, ZW)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  vatCode?: string;

  // Legacy aliases from previous frontend versions
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vat?: number;
}
