import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CostItemsController } from './cost-items.controller';
import { CostItemsService } from './cost-items.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CostItemsController],
  providers: [CostItemsService],
  exports: [CostItemsService],
})
export class CostItemsModule {}
