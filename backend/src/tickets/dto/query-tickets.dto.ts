import { IsOptional, IsEnum, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriorityDto } from './create-ticket.dto';
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

  @ApiPropertyOptional({ description: 'UUID przypisanego agenta' })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @ApiPropertyOptional({ description: 'Wyszukiwanie po tytule/opisie' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sortowanie: createdAt_asc, createdAt_desc, updatedAt_desc, priority_desc',
    default: 'createdAt_desc',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt_desc';
}
