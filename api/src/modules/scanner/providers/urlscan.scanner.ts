import { Injectable } from '@nestjs/common';

import {
  ScannerResult,
} from '../interfaces/scanner-result.interface';

@Injectable()
export class UrlscanScanner {
  private readonly apiUrl =
    'https://urlscan.io/api/v1';

  private readonly apiKey =
    process.env.URLSCAN_API_KEY;

  async search(
    url: string,
  ): Promise<ScannerResult> {
    if (!this.apiKey) {
      return {
        provider: 'urlscan',
        status: 'unknown',
        message:
          'URLSCAN_API_KEY sozlanmagan.',
      };
    }

    try {
      const query = encodeURIComponent(
        `page.url:"${url}"`,
      );

      const response = await fetch(
        `${this.apiUrl}/search/?q=${query}`,
        {
          method: 'GET',
          headers: {
            'API-Key': this.apiKey,
            Accept: 'application/json',
          },
        },
      );

      const responseText =
        await response.text();

      console.log(
        'URLScan Search HTTP status:',
        response.status,
      );

      if (!response.ok) {
        console.error(
          'URLScan Search response:',
          responseText,
        );

        return {
          provider: 'urlscan',
          status: 'unknown',
          message:
            `URLScan Search API xatosi: HTTP ${response.status}`,
          raw: responseText,
        };
      }

      const data =
        JSON.parse(responseText);

      const results =
        data?.results ?? [];

      if (
        !Array.isArray(results) ||
        results.length === 0
      ) {
        return {
          provider: 'urlscan',
          status: 'unknown',
          message:
            'URLScan bazasida ushbu URL bo‘yicha oldingi scan topilmadi.',
          raw: data,
        };
      }

      /*
       * Eng yangi scan natijasini olamiz.
       */
      const latest =
        results[0];

      const verdicts =
        latest?.verdicts;

      const malicious =
        verdicts?.overall?.malicious === true;

      const score =
        verdicts?.overall?.score;

      if (malicious) {
        return {
          provider: 'urlscan',
          status: 'dangerous',
          message:
            'URLScan ushbu manbani zararli deb baholagan.',
          raw: latest,
        };
      }

      /*
       * Agar URLScan umumiy score
       * mavjud bo‘lsa, keyinchalik
       * Risk Engine'da ishlatamiz.
       */
      if (
        typeof score === 'number' &&
        score > 0
      ) {
        return {
          provider: 'urlscan',
          status: 'suspicious',
          message:
            `URLScan risk score: ${score}.`,
          raw: latest,
        };
      }

      return {
        provider: 'urlscan',
        status: 'safe',
        message:
          'URLScan mavjud scan natijasida aniq zararli verdict topmadi.',
        raw: latest,
      };
    } catch (error: any) {
      console.error(
        'URLScan Search error:',
        error?.message || error,
      );

      return {
        provider: 'urlscan',
        status: 'unknown',
        message:
          'URLScan bilan bog‘lanishda xatolik yuz berdi.',
        raw: error?.message || error,
      };
    }
  }
}