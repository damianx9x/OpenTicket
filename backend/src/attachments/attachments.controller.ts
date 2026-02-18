import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

@ApiTags('Attachments')
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('tickets/:ticketId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Zarejestruj załącznik i otrzymaj presigned URL do uploadu',
    description:
      'Tworzy rekord załącznika w bazie i zwraca presigned PUT URL do MinIO. Klient uploaduje plik bezpośrednio pod ten URL.',
  })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiResponse({ status: 201, description: 'Załącznik zarejestrowany + uploadUrl' })
  async create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateAttachmentDto,
  ) {
    dto.ticketId = ticketId;
    return this.attachmentsService.createWithUploadUrl(dto);
  }

  @Get('tickets/:ticketId/attachments')
  @ApiOperation({ summary: 'Lista załączników ticketu' })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiResponse({ status: 200, description: 'Lista załączników' })
  async list(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.attachmentsService.findByTicketId(ticketId);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Pobierz presigned URL do pobrania pliku' })
  @ApiParam({ name: 'id', description: 'UUID załącznika' })
  @ApiResponse({ status: 200, description: 'Presigned download URL' })
  @ApiResponse({ status: 404, description: 'Załącznik nie znaleziony' })
  async download(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Usuń załącznik (DB + storage)' })
  @ApiParam({ name: 'id', description: 'UUID załącznika' })
  @ApiResponse({ status: 200, description: 'Załącznik usunięty' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.remove(id);
  }
}
