import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageStrategy } from './local-storage.strategy';
import { S3StorageStrategy } from './s3-storage.strategy';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [StorageService, LocalStorageStrategy, S3StorageStrategy],
  exports: [StorageService],
})
export class StorageModule {}
