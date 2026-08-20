import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';
import { UrlhausScanner } from './providers/urlhaus.scanner';
import { RiskEngineService } from './risk/risk-engine.service';
import { ScannerService } from './scanner.service';
import { VirusTotalScanner } from './providers/virustotal.scanner';
import { UrlscanScanner } from './providers/urlscan.scanner';

@Controller('scanner')
export class ScannerController {
  constructor(
  private readonly googleScanner: GoogleSafeBrowsingScanner,
  private readonly urlhausScanner: UrlhausScanner,
  private readonly virusTotalScanner: VirusTotalScanner,
  private readonly urlscanScanner: UrlscanScanner,
  private readonly scannerService: ScannerService,
  private readonly riskEngine: RiskEngineService,
) {}

  @Post('check')
  async check(
    @Body() body: { url: string },
  ) {
    const results =
      await this.scannerService.scanUrl(
        body.url,
        [
          this.googleScanner,
          this.urlhausScanner,
          this.virusTotalScanner,
        ],
      );

    const status =
      this.riskEngine.analyze(results);

    const score =
      this.riskEngine.calculateScore(
        results,
      );

    const riskLevel =
      this.riskEngine.getRiskLevel(score);

    return {
      url: body.url,

      status,

      risk: {
        score,
        level: riskLevel,
      },

      results,
    };
  }

  // Eski test endpointlari.
  @Post('google')
  async googleScan(
    @Body() body: { url: string },
  ) {
    return this.googleScanner.scan(body.url);
  }

  @Post('urlhaus')
  async urlhausScan(
    @Body() body: { url: string },
  ) {
    return this.urlhausScanner.scan(body.url);
  }

  @Post('urlscan-search')
async urlscanSearch(
  @Body() body: { url: string },
) {
  return this.urlscanScanner.search(body.url);
}

@Post('urlscan-submit')
async urlscanSubmit(
  @Body() body: { url: string },
) {
  return this.urlscanScanner.submitScan(
    body.url,
  );
}

}