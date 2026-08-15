import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';

import { ScannerResult } from '../interfaces/scanner-result.interface';

@Injectable()
export class GoogleSafeBrowsingScanner {
  private readonly apiKey =
    process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  private readonly client = google.safebrowsing('v5');

  async scan(url: string): Promise<ScannerResult> {
    if (!this.apiKey) {
      return {
        provider: 'google-safe-browsing',
        status: 'unknown',
        message:
          'GOOGLE_SAFE_BROWSING_API_KEY topilmadi.',
      };
    }

    try {
      const response =
        await this.client.urls.search({
          key: this.apiKey,
          urls: [url],
        });

      const threats =
        response.data.threats ?? [];

      // Hech qanday tahdid topilmadi
      if (threats.length === 0) {
        return {
          provider: 'google-safe-browsing',
          status: 'safe',
          message:
            'Google Safe Browsing ma’lum tahdid topmadi.',
          raw: response.data,
        };
      }

      // Threat turlarini yig‘amiz
      const categories: string[] = [
        ...new Set(
          threats.flatMap((threat) =>
            (threat.threatTypes ?? []).filter(
              (
                item,
              ): item is string =>
                typeof item === 'string',
            ),
          ),
        ),
      ];

      return {
        provider: 'google-safe-browsing',
        status: 'dangerous',
        categories,
        message:
          'Google Safe Browsing tahdid aniqladi.',
        raw: response.data,
      };
    } catch (error: any) {
      console.error(
        'Google Safe Browsing error:',
        error?.response?.data ||
          error?.message ||
          error,
      );

      return {
        provider: 'google-safe-browsing',
        status: 'unknown',
        message:
          'Google Safe Browsing bilan bog‘lanishda xatolik yuz berdi.',
        raw: error,
      };
    }
  }
}