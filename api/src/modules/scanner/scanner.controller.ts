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
import {
  ScannerResult,
} from './interfaces/scanner-result.interface';

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
    this.riskEngine.calculateScore(results);

  const riskLevel =
    this.scannerService.getRiskLevel(
      score,
      status,
    );

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

@Post('deep-scan')
async deepScan(
  @Body()
  body: {
    url: string;
    results?: ScannerResult[];
  },
) {
  const result =
    await this.scannerService.startUrlscanDeep(
      body.url,
    );

  const raw =
    result.raw &&
    typeof result.raw === 'object'
      ? result.raw as {
          pending?: boolean;
          resultUrl?: string;
        }
      : null;

  return {
    url: body.url,

    status: result.status,

    message: result.message,

    result,

    deepScan: {
      started:
        result.status === 'unknown' &&
        raw?.pending === true,

      pending:
        raw?.pending === true,

      resultUrl:
        raw?.resultUrl ?? null,
    },
  };
}

@Post('deep-poll')
async deepPoll(
  @Body()
  body: {
    resultUrl: string;
    results?: ScannerResult[];
  },
) {
  if (!body.resultUrl) {
    return {
      status: 'unknown',
      message:
        'URLScan resultUrl berilmagan.',
    };
  }

  const result =
    await this.scannerService.pollUrlscanDeep(
      body.resultUrl,
      body.results ?? [],
    );

  return {
    result: result.result,
    finalRisk: result.finalRisk,
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

@Post('urlscan-result')
async urlscanResult(
  @Body() body: { resultUrl: string },
) {
  return this.urlscanScanner.getResult(
    body.resultUrl,
  );
}

@Post('urlscan-smart')
async urlscanSmart(
  @Body() body: { url: string },
) {
  return this.urlscanScanner.smartScan(
    body.url,
  );
}

@Post('urlscan-poll')
async urlscanPoll(
  @Body() body: {
    resultUrl: string;
  },
) {
  return this.urlscanScanner.pollResult(
    body.resultUrl,
  );
}

}