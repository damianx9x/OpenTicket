import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrScanController } from './qr-scan.controller';
import { QrService } from './qr.service';

@Module({
  controllers: [QrController, QrScanController],
  providers: [QrService],
  exports: [QrService],
})
export class QrcodeModule {}
