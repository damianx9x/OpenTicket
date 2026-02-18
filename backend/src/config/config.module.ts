import { Module, Global } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';

@Global()
@Module({
  providers: [ConfigLoaderService],
  exports: [ConfigLoaderService],
})
export class ConfigModule {}
