import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrScanController } from './qr-scan.controller';
import { QrService } from './qr.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [QrController, QrScanController],
  providers: [QrService],
  exports: [QrService],
})
export class QrcodeModule {}
