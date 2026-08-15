import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';
import { UrlhausScanner } from './providers/urlhaus.scanner';

@Controller('scanner')
export class ScannerController {
  constructor(
    private readonly googleScanner: GoogleSafeBrowsingScanner,
    private readonly urlhausScanner: UrlhausScanner,
  ) {}

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
}