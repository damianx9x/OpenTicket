import { IsString, IsNotEmpty, IsUUID, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttachmentDto {
  @ApiProperty({ description: 'UUID ticketu' })
  @IsUUID()
  ticketId: string;

  @ApiPropertyOptional({ description: 'UUID użytkownika uploadującego' })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  @ApiProperty({ example: 'zdjecie-uszkodzenia.jpg' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ example: 1048576, description: 'Rozmiar pliku w bajtach' })
  @IsInt()
  @Min(1)
  byteSize: number;
}
