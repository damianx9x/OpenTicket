import { Module } from '@nestjs/common';
import { PairingsController, ProvisionController } from './provision.controller';

@Module({
  controllers: [ProvisionController, PairingsController],
})
export class ProvisionModule {}
