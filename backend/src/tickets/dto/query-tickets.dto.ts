import { IsOptional, IsEnum, IsInt, Min, Max, IsString, IsBoolean, IsDateString, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketChannelDto, TicketPriorityDto } from './create-ticket.dto';
import { TicketStatusDto } from './update-ticket.dto';

export class QueryTicketsDto {
  @ApiPropertyOptional({ description: 'Numer strony (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Ilość wyników na stronę', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: TicketStatusDto })
  @IsOptional()
  @IsEnum(TicketStatusDto)
  status?: TicketStatusDto;

  @ApiPropertyOptional({ enum: TicketPriorityDto })
  @IsOptional()
  @IsEnum(TicketPriorityDto)
  priority?: TicketPriorityDto;

  @ApiPropertyOptional({ enum: TicketChannelDto })
  @IsOptional()
  @IsEnum(TicketChannelDto)
  channel?: TicketChannelDto;

  @ApiPropertyOptional({ description: 'UUID przypisanego agenta' })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @ApiPropertyOptional({ description: 'assigned | unassigned' })
  @IsOptional()
  @IsString()
  @IsIn(['assigned', 'unassigned'])
  assignedState?: 'assigned' | 'unassigned';

  @ApiPropertyOptional({ description: 'Wyszukiwanie po tytule/opisie' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Pokaż wyłącznie zgłoszenia przypisane lub utworzone przez bieżącego użytkownika' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  })
  @IsBoolean()
  onlyMine?: boolean;

  @ApiPropertyOptional({ description: 'Pokaż zgłoszenia starsze niż X dni (wg createdAt)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  minAgeDays?: number;

  @ApiPropertyOptional({ description: 'Pokaż tylko zgłoszenia z załącznikami (true/false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return undefined;
  })
  @IsBoolean()
  hasAttachments?: boolean;

  @ApiPropertyOptional({ description: 'Pokaż tylko zgłoszenia z komentarzami (true/false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return undefined;
  })
  @IsBoolean()
  hasComments?: boolean;

  @ApiPropertyOptional({ description: 'Data utworzenia od (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Data utworzenia do (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({
    description:
      'Sortowanie: createdAt_asc, createdAt_desc, updatedAt_asc, updatedAt_desc, priority_asc, priority_desc, number_asc, number_desc, status_asc, status_desc',
    default: 'createdAt_desc',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt_desc';
}
