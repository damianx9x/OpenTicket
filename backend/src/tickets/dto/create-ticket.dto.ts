import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TicketPriorityDto {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketChannelDto {
  APP = 'APP',
  WEB_FORM = 'WEB_FORM',
  EMAIL = 'EMAIL',
  DROP_OFF = 'DROP_OFF',
}

export class CreateTicketDto {
  @ApiProperty({ example: 'Laptop nie uruchamia się' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'Po naciśnięciu przycisku power nic się nie dzieje, dioda nie świeci.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({ enum: TicketPriorityDto, default: 'NORMAL' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(TicketPriorityDto)
  priority?: TicketPriorityDto;

  @ApiPropertyOptional({ enum: TicketChannelDto, default: 'WEB_FORM' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(TicketChannelDto)
  channel?: TicketChannelDto;

  @ApiPropertyOptional({ description: 'UUID użytkownika zgłaszającego' })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional({ description: 'UUID organizacji' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'UUID agenta przypisanego' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;

  // Legacy / UI compatibility fields (currently optional, mapped server-side)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
