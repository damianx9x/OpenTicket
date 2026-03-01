import { Module } from '@nestjs/common';
import { PairingsController, ProvisionController } from './provision.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProvisionController, PairingsController],
})
export class ProvisionModule {}
