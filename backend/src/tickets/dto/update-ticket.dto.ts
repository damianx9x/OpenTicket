import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsUUID, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriorityDto } from './create-ticket.dto';

export enum TicketStatusDto {
  RECEIVED = 'RECEIVED',
  DIAGNOSIS = 'DIAGNOSIS',
  QUOTE_READY = 'QUOTE_READY',
  PARTS_ORDERED = 'PARTS_ORDERED',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  SENT_TO_CUSTOMER = 'SENT_TO_CUSTOMER',
  // Legacy statuses kept for backward compatibility with old datasets
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_FOR_CUSTOMER = 'WAITING_FOR_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ example: 'Zaktualizowany tytuł' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional({ example: 'Dodatkowe informacje...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TicketStatusDto })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(TicketStatusDto)
  status?: TicketStatusDto;

  @ApiPropertyOptional({ enum: TicketPriorityDto })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(TicketPriorityDto)
  priority?: TicketPriorityDto;

  @ApiPropertyOptional({ description: 'UUID agenta przypisanego' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  @ApiPropertyOptional({ description: 'Legacy alias z wcześniejszego frontendu' })
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
