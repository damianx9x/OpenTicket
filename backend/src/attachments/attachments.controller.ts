import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';

@ApiTags('Attachments')
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('tickets/:ticketId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER')
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    dto.ticketId = ticketId;
    dto.uploadedBy = user.id;
    return this.attachmentsService.createWithUploadUrl(dto);
  }

  @Post('tickets/:ticketId/attachments/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Bezpośredni upload pliku załącznika (local/s3) i zapis metadanych',
  })
  async upload(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile()
    file?: {
      originalname?: string;
      mimetype?: string;
      size?: number;
      buffer?: Buffer;
    },
  ) {
    if (!file?.originalname || !file?.mimetype || !file?.size || !file?.buffer) {
      throw new BadRequestException('Brak pliku w polu "file".');
    }

    return this.attachmentsService.uploadAndCreate(
      ticketId,
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      user.id,
    );
  }

  @Get('tickets/:ticketId/attachments')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
  @ApiOperation({ summary: 'Lista załączników ticketu' })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiResponse({ status: 200, description: 'Lista załączników' })
  async list(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.attachmentsService.findByTicketId(ticketId);
  }

  @Get('attachments/:id/download')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
  @ApiOperation({ summary: 'Pobierz presigned URL do pobrania pliku' })
  @ApiParam({ name: 'id', description: 'UUID załącznika' })
  @ApiResponse({ status: 200, description: 'Presigned download URL' })
  @ApiResponse({ status: 404, description: 'Załącznik nie znaleziony' })
  async download(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  @Get('attachments/:id/file')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
  @ApiOperation({ summary: 'Pobierz plik załącznika (stream/redirect)' })
  async file(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const access = await this.attachmentsService.resolveFileAccess(id);
    if (access.mode === 'redirect') {
      return res.redirect(access.url);
    }

    return res.type(access.mimeType).download(access.filePath, access.filename);
  }

  @Delete('attachments/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Usuń załącznik (DB + storage)' })
  @ApiParam({ name: 'id', description: 'UUID załącznika' })
  @ApiResponse({ status: 200, description: 'Załącznik usunięty' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.remove(id);
  }
}
