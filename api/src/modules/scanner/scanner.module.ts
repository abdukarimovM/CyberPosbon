import { Module } from '@nestjs/common';

import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';
import { UrlhausScanner } from './providers/urlhaus.scanner';


@Module({
  controllers: [ScannerController],
  providers: [
    ScannerService,
    GoogleSafeBrowsingScanner,
    UrlhausScanner,
  ],
  exports: [ScannerService],
})
export class ScannerModule {}