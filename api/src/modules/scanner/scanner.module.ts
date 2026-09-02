import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

// URL provayderlari
import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';
import { UrlhausScanner } from './providers/urlhaus.scanner';
import { VirusTotalScanner } from './providers/virustotal.scanner';
import { UrlscanScanner } from './providers/urlscan.scanner';

// Fayl provayderlari va xesh servis
import { VirusTotalFileScanner } from './providers/virustotal-file.scanner';
import { FileHashService } from './file/file-hash.service';

// Risk Engine
import { RiskEngineService } from './risk/risk-engine.service';

@Module({
  imports: [
    // Multer fayllarni vaqtinchalik saqlash sozlamasi
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [
    ScannerController,
  ],
  providers: [
    ScannerService,
    RiskEngineService,
    FileHashService,
    // URL Scanners
    GoogleSafeBrowsingScanner,
    UrlhausScanner,
    VirusTotalScanner,
    UrlscanScanner,
    // File Scanners
    VirusTotalFileScanner,
  ],
  exports: [
    ScannerService,
    RiskEngineService,
    FileHashService,
  ],
})
export class ScannerModule { }