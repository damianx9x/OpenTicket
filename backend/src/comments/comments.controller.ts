import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Comments')
@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dodaj komentarz do ticketu' })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiResponse({ status: 201, description: 'Komentarz dodany' })
  async create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
  ) {
    // Ensure ticketId from URL is used
    dto.ticketId = ticketId;
    return this.commentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista komentarzy ticketu' })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiQuery({ name: 'includeInternal', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista komentarzy' })
  async list(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query('includeInternal') includeInternal?: string,
  ) {
    const internal = includeInternal !== 'false';
    return this.commentsService.findByTicketId(ticketId, internal);
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Usuń komentarz' })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiParam({ name: 'commentId', description: 'UUID komentarza' })
  @ApiResponse({ status: 200, description: 'Komentarz usunięty' })
  async remove(@Param('commentId', ParseUUIDPipe) commentId: string) {
    return this.commentsService.remove(commentId);
  }
}
