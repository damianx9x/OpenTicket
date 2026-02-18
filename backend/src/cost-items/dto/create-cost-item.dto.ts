import { IsString, IsNotEmpty, IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCostItemDto {
  @ApiProperty({ description: 'UUID ticketu' })
  @IsUUID()
  ticketId: string;

  @ApiProperty({ example: 'Wymiana baterii laptopa' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, description: 'Ilość (szt, godz, etc.)' })
  @IsNumber()
  @Min(0.001)
  qty: number;

  @ApiProperty({ example: 150.00, description: 'Cena jednostkowa netto (PLN)' })
  @IsNumber()
  @Min(0)
  unitNet: number;

  @ApiProperty({ example: '23', description: 'Kod stawki VAT (np. 23, 8, 5, 0, ZW)' })
  @IsString()
  @IsNotEmpty()
  vatCode: string;
}
