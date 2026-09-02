import { Injectable } from '@nestjs/common';
import { ScannerResult } from '../interfaces/scanner-result.interface';

@Injectable()
export class UrlhausScanner {
  private readonly apiUrl = 'https://urlhaus-api.abuse.ch/v1/url/';
  private readonly authKey = process.env.URLHAUS_AUTH_KEY;

  async scan(url: string): Promise<ScannerResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      };

      // Agar Auth-Key mavjud bo'lsa qo'shamiz (URLhaus ayrim so'rovlarni kalitsiz ham cheklangan holda qabul qiladi)
      if (this.authKey) {
        headers['Auth-Key'] = this.authKey;
      }

      const body = new URLSearchParams({ url });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error(`URLhaus HTTP xatosi (${response.status}):`, responseText);
        return {
          provider: 'urlhaus',
          status: 'unknown',
          message: `URLhaus API xatosi: HTTP ${response.status}`,
          raw: responseText,
        };
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        return {
          provider: 'urlhaus',
          status: 'unknown',
          message: 'URLhaus javobini tahlil qilib bo‘lmadi.',
          raw: responseText,
        };
      }

      // 1. ZARARLI MANBA SIFATIDA TOPILDI
      if (data.query_status === 'ok') {
        const threat = data.threat || 'malware';
        const tags = Array.isArray(data.tags) ? data.tags.join(', ') : '';
        const tagText = tags ? ` (Teglar: ${tags})` : '';

        return {
          provider: 'urlhaus',
          status: 'dangerous',
          categories: ['malware'],
          message: `URLhaus: Zararli manba aniqlandi! Tahdid: ${threat}${tagText}`,
          raw: data,
        };
      }

      // 2. TAHdid TOPILMADI (URLhaus qora ro'yxatida yo'q)
      if (data.query_status === 'no_results') {
        return {
          provider: 'urlhaus',
          status: 'safe',
          message: 'URLhaus bazasida zararli faoliyat aniqlanmadi.',
          raw: data,
        };
      }

      // 3. YAROQSIZ URL FORMATI
      if (data.query_status === 'invalid_url') {
        return {
          provider: 'urlhaus',
          status: 'unknown',
          message: 'URLhaus havolani yaroqli deb topmadi.',
          raw: data,
        };
      }

      return {
        provider: 'urlhaus',
        status: 'unknown',
        message: 'URLhaus aniq maʼlumot bermadi.',
        raw: data,
      };

    } catch (error: any) {
      console.error('❌ URLhaus scanner error:', error?.message || error);

      return {
        provider: 'urlhaus',
        status: 'unknown',
        message: 'URLhaus xizmati bilan bog‘lanishda xatolik yuz berdi.',
        raw: error?.message,
      };
    }
  }
}