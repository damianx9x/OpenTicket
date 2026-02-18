import { Controller, Post, Body, BadRequestException, Logger } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupRequest, SetupResponse } from '../config/config.types';

@Controller('setup')
export class SetupController {
  private readonly logger = new Logger(SetupController.name);

  constructor(private setupService: SetupService) {}

  @Post('init')
  async initializeSystem(@Body() request: SetupRequest): Promise<SetupResponse> {
    this.logger.log('Setup initialization requested');

    try {
      // Validate request
      if (!request.dataPath || !request.adminEmail || !request.adminPassword) {
        throw new BadRequestException('Missing required fields: dataPath, adminEmail, adminPassword');
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
    const isSetup = await this.setupService.isSystemSetup();
    return {
      isSetup,
      setupMode: !isSetup,
    };
  }
}
