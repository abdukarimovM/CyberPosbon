import { Module } from '@nestjs/common';

import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';
import { UrlhausScanner } from './providers/urlhaus.scanner';
import { VirusTotalScanner } from './providers/virustotal.scanner';
import { UrlscanScanner } from './providers/urlscan.scanner';

import { VirusTotalFileScanner } from './providers/virustotal-file.scanner';

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
    VirusTotalScanner,
    UrlscanScanner,
    VirusTotalFileScanner,
  ],

  exports: [
    ScannerService,
    RiskEngineService,
  ],
})
export class ScannerModule {}