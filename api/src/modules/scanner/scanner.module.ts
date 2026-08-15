import { Module } from '@nestjs/common';

import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';

@Module({
  controllers: [ScannerController],
  providers: [
    ScannerService,
    GoogleSafeBrowsingScanner,
  ],
  exports: [ScannerService],
})
export class ScannerModule {}