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
  @IsEnum(TicketPriorityDto)
  priority?: TicketPriorityDto;

  @ApiPropertyOptional({ enum: TicketChannelDto, default: 'WEB_FORM' })
  @IsOptional()
  @IsEnum(TicketChannelDto)
  channel?: TicketChannelDto;

  @ApiProperty({ description: 'UUID użytkownika zgłaszającego' })
  @IsUUID()
  ownerUserId: string;

  @ApiPropertyOptional({ description: 'UUID organizacji' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'UUID agenta przypisanego' })
  @IsOptional()
  @IsUUID()
  assignedAgentId?: string;
}
