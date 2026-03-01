import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
  ForbiddenException,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SetupService } from './setup.service';
import {
  ClientOnlySetupRequest,
  DiscoverLocalDataResponse,
  DiscoverServersRequest,
  DiscoverServersResponse,
  ClaimSetupTokenRequest,
  ClaimSetupTokenResponse,
  CreateSetupTokenRequest,
  CreateSetupTokenResponse,
  RevokeSetupTokenResponse,
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
  async initializeSystem(@Body() request: SetupRequest, @Req() req: Request): Promise<SetupResponse> {
    this.logger.log('Setup initialization requested');
    await this.assertSetupAccess(req, request);

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
  @HttpCode(HttpStatus.OK)
  async getSetupStatus() {
    return this.setupService.getSetupStatus();
  }

  @Post('client-only')
  async initializeClientOnly(
    @Body() request: ClientOnlySetupRequest,
    @Req() req: Request,
  ): Promise<SetupResponse> {
    this.logger.log('Client-only setup requested');
    await this.assertSetupAccess(req, request);

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
  async validateDataPath(@Body() body: { dataPath?: string; setupSessionToken?: string }, @Req() req: Request) {
    await this.assertSetupAccess(req, body);
    return this.setupService.validateDataPath(body?.dataPath);
  }

  @Post('discover-local-data')
  async discoverLocalData(@Req() req: Request): Promise<DiscoverLocalDataResponse> {
    this.assertLoopbackRequest(req);
    return this.setupService.discoverLocalDataSources();
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
  async resetForDev(@Req() req: Request) {
    this.assertLoopbackRequest(req);
    return this.setupService.resetForDev();
  }

  @Post('token/create')
  async createRemoteSetupToken(
    @Body() request: CreateSetupTokenRequest,
    @Req() req: Request,
  ): Promise<CreateSetupTokenResponse> {
    this.assertLoopbackRequest(req);
    return this.setupService.createRemoteSetupToken(request || {});
  }

  @Post('token/claim')
  @HttpCode(HttpStatus.OK)
  async claimRemoteSetupToken(@Body() body: ClaimSetupTokenRequest): Promise<ClaimSetupTokenResponse> {
    if (!body?.token || body.token.trim().length < 3) {
      throw new BadRequestException('Missing required field: token');
    }
    return this.setupService.claimRemoteSetupToken(body.token.trim());
  }

  @Post('token/revoke')
  async revokeRemoteSetupToken(
    @Body() body: { setupSessionToken?: string } | undefined,
    @Req() req: Request,
  ): Promise<RevokeSetupTokenResponse> {
    if (!this.isLoopbackRequest(req)) {
      await this.assertSetupAccess(req, body);
    }
    return this.setupService.revokeRemoteSetupToken();
  }

  private async assertSetupAccess(req: Request, body?: { setupSessionToken?: string }): Promise<void> {
    if (this.isLoopbackRequest(req)) {
      return;
    }
    if (process.env.TICKET_SYSTEM_ALLOW_REMOTE_SETUP === '1') {
      return;
    }

    const token = this.extractSetupSessionToken(req, body);
    const valid = await this.setupService.validateSetupSessionToken(token);
    if (valid) {
      return;
    }

    throw new ForbiddenException('Setup endpoint requires local request or valid setup session token.');
  }

  private extractSetupSessionToken(req: Request, body?: { setupSessionToken?: string }): string | undefined {
    if (body?.setupSessionToken && body.setupSessionToken.trim().length > 0) {
      return body.setupSessionToken.trim();
    }

    const headerValue = req.header('x-setup-session-token');
    if (headerValue && headerValue.trim().length > 0) {
      return headerValue.trim();
    }

    return undefined;
  }

  private assertLoopbackRequest(req: Request): void {
    if (this.isLoopbackRequest(req)) {
      return;
    }
    if (process.env.TICKET_SYSTEM_ALLOW_REMOTE_SETUP === '1') {
      return;
    }
    throw new ForbiddenException('Endpoint is available only from local machine.');
  }

  private isLoopbackRequest(req: Request): boolean {
    const rawIp = (req.ip || req.socket.remoteAddress || '').trim();
    const firstHop = rawIp.split(',')[0].trim();
    const ip = firstHop.replace(/^::ffff:/, '');
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return true;
    }
    return false;
  }
}
