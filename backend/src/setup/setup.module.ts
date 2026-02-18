import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
