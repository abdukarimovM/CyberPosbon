import { Module } from '@nestjs/common';

import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';
import { UrlhausScanner } from './providers/urlhaus.scanner';

import { RiskEngineService } from './risk/risk-engine.service';

@Module({
  controllers: [
    ScannerController,
  ],

  providers: [
    ScannerService,
    GoogleSafeBrowsingScanner,
    UrlhausScanner,
    RiskEngineService,
  ],

  exports: [
    ScannerService,
    RiskEngineService,
  ],
})
export class ScannerModule {}