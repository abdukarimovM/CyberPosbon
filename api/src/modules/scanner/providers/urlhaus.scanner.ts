import { Injectable } from '@nestjs/common';

import { ScannerResult } from '../interfaces/scanner-result.interface';

@Injectable()
export class UrlhausScanner {
  private readonly authKey =
    process.env.URLHAUS_AUTH_KEY;

  async scan(
    url: string,
  ): Promise<ScannerResult> {
    if (!this.authKey) {
      return {
        provider: 'urlhaus',
        status: 'unknown',
        message:
          'URLHAUS_AUTH_KEY topilmadi.',
      };
    }

    try {
      const body = new URLSearchParams({
        url,
      });

      const response = await fetch(
        'https://urlhaus-api.abuse.ch/v1/url/',
        {
          method: 'POST',
          headers: {
            'Auth-Key': this.authKey,
            'Content-Type':
              'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: body.toString(),
        },
      );

      const responseText =
        await response.text();

      console.log(
        'URLhaus HTTP status:',
        response.status,
      );

      console.log(
        'URLhaus response:',
        responseText,
      );

      if (!response.ok) {
        return {
          provider: 'urlhaus',
          status: 'unknown',
          message:
            `URLhaus API xatosi: HTTP ${response.status}`,
          raw: responseText,
        };
      }

      const data = JSON.parse(responseText);

      if (data.query_status === 'ok') {
        return {
          provider: 'urlhaus',
          status: 'dangerous',
          categories: ['malware'],
          message:
            'URLhaus ushbu URLni malware tarqatuvchi manba sifatida topdi.',
          raw: data,
        };
      }

      if (
        data.query_status === 'no_results'
      ) {
        return {
          provider: 'urlhaus',
          status: 'unknown',
          message:
            'URLhaus bazasida ushbu URL bo‘yicha yozuv topilmadi.',
          raw: data,
        };
      }

      if (
        data.query_status === 'invalid_url'
      ) {
        return {
          provider: 'urlhaus',
          status: 'unknown',
          message:
            'URLhaus URLni yaroqli URL deb tanimadi.',
          raw: data,
        };
      }

      return {
        provider: 'urlhaus',
        status: 'unknown',
        message:
          'URLhaus aniq natija qaytarmadi.',
        raw: data,
      };
    } catch (error: any) {
      console.error(
        'URLhaus scanner error:',
        error?.message || error,
      );

      return {
        provider: 'urlhaus',
        status: 'unknown',
        message:
          'URLhaus bilan bog‘lanishda xatolik yuz berdi.',
        raw: error?.message || error,
      };
    }
  }
}