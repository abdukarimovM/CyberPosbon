import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';

@Controller('scanner')
export class ScannerController {
  constructor(
    private readonly googleScanner: GoogleSafeBrowsingScanner,
  ) {}

  @Post('google')
  async googleScan(
    @Body() body: { url: string },
  ) {
    return this.googleScanner.scan(body.url);
  }
}