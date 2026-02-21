import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { SetupService } from './setup.service';
import {
  ClientOnlySetupRequest,
  DiscoverServersRequest,
  DiscoverServersResponse,
  SetupRequest,
  SetupResponse,
  ValidateRemoteServerResponse,
} from '../config/config.types';
import { Request } from 'express';

@Controller('setup')
export class SetupController {
  private readonly logger = new Logger(SetupController.name);

  constructor(private setupService: SetupService) {}

  @Post('init')
  async initializeSystem(@Body() request: SetupRequest): Promise<SetupResponse> {
    this.logger.log('Setup initialization requested');

    try {
      // Validate request
      if (!request.adminEmail || !request.adminPassword) {
        throw new BadRequestException('Missing required fields: adminEmail, adminPassword');
      }

      // Run setup
      const result = await this.setupService.initializeSystem(request);
      return result;
    } catch (error: any) {
      this.logger.error(`Setup failed: ${error.message}`);
      return {
        success: false,
        message: `Setup failed: ${error.message}`,
      };
    }
  }

  @Post('status')
  async getSetupStatus() {
    return this.setupService.getSetupStatus();
  }

  @Post('client-only')
  async initializeClientOnly(@Body() request: ClientOnlySetupRequest): Promise<SetupResponse> {
    this.logger.log('Client-only setup requested');

    if (!request?.remoteApiBaseUrl || request.remoteApiBaseUrl.trim().length === 0) {
      throw new BadRequestException('Missing required field: remoteApiBaseUrl');
    }

    try {
      return await this.setupService.initializeClientOnlyMode(request);
    } catch (error: any) {
      this.logger.error(`Client-only setup failed: ${error.message}`);
      return {
        success: false,
        message: `Client-only setup failed: ${error.message}`,
      };
    }
  }

  @Post('validate-path')
  async validateDataPath(@Body() body: { dataPath?: string }) {
    return this.setupService.validateDataPath(body?.dataPath);
  }

  @Post('discover-servers')
  async discoverServers(
    @Body() request: DiscoverServersRequest,
    @Req() req: Request,
  ): Promise<DiscoverServersResponse> {
    this.assertLoopbackRequest(req);
    return this.setupService.discoverRemoteServers(request);
  }

  @Post('validate-remote')
  async validateRemote(
    @Body() body: { remoteApiBaseUrl?: string },
    @Req() req: Request,
  ): Promise<ValidateRemoteServerResponse> {
    this.assertLoopbackRequest(req);
    if (!body?.remoteApiBaseUrl || body.remoteApiBaseUrl.trim().length === 0) {
      throw new BadRequestException('Missing required field: remoteApiBaseUrl');
    }
    return this.setupService.validateRemoteServer(body.remoteApiBaseUrl);
  }

  @Post('dev-reset')
  async resetForDev() {
    return this.setupService.resetForDev();
  }

  private assertLoopbackRequest(req: Request): void {
    const rawIp = (req.ip || req.socket.remoteAddress || '').trim();
    const ip = rawIp.replace(/^::ffff:/, '');
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return;
    }
    throw new ForbiddenException('Endpoint is available only from local machine.');
  }
}
