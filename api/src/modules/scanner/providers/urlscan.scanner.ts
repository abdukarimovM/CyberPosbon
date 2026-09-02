import { Injectable } from '@nestjs/common';
import { ScannerResult } from '../interfaces/scanner-result.interface';

@Injectable()
export class UrlscanScanner {
  private readonly apiUrl = 'https://urlscan.io/api/v1';
  private readonly apiKey = process.env.URLSCAN_API_KEY;

  /**
   * Standart scanner interfeysi uchun kirish metodi
   */
  async scan(url: string): Promise<ScannerResult> {
    return this.smartScan(url);
  }

  /**
   * URLScan bazasidan avvalgi scanlarni qidirish
   */
  async search(url: string): Promise<ScannerResult> {
    if (!this.apiKey) {
      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLSCAN_API_KEY sozlanmagan.',
      };
    }

    try {
      // URL va domenni aniqroq qamrab oluvchi qidiruv
      const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const query = encodeURIComponent(`page.url:"${url}" OR page.domain:"${cleanUrl}"`);

      const response = await fetch(`${this.apiUrl}/search/?q=${query}&size=3`, {
        method: 'GET',
        headers: {
          'API-Key': this.apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          provider: 'urlscan',
          status: 'unknown',
          message: `URLScan Search xatosi: HTTP ${response.status}`,
          raw: responseText,
        };
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        return {
          provider: 'urlscan',
          status: 'unknown',
          message: 'URLScan javobini tahlil qilib bo‘lmadi.',
        };
      }

      const results = data?.results ?? [];

      if (!Array.isArray(results) || results.length === 0) {
        return {
          provider: 'urlscan',
          status: 'unknown',
          message: 'URLScan bazasida ushbu havola bo‘yicha avvalgi tahlil topilmadi.',
          raw: data,
        };
      }

      // Eng oxirgi scan natijasini baholash
      const latest = results[0];
      const verdicts = latest?.verdicts;
      const malicious = verdicts?.overall?.malicious === true || verdicts?.engines?.maliciousTotal > 0;
      const score = verdicts?.overall?.score ?? 0;

      if (malicious) {
        return {
          provider: 'urlscan',
          status: 'dangerous',
          message: 'URLScan ushbu manbani zararli deb topgan.',
          raw: latest,
        };
      }

      if (score > 0) {
        return {
          provider: 'urlscan',
          status: 'suspicious',
          message: `URLScan shubhali deb topdi (Xavf bali: ${score}).`,
          raw: latest,
        };
      }

      return {
        provider: 'urlscan',
        status: 'safe',
        message: 'URLScan mavjud maʼlumotlarida zararli faoliyat aniqlanmadi.',
        raw: latest,
      };
    } catch (error: any) {
      console.error('❌ URLScan search error:', error?.message || error);
      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLScan qidiruv tizimi bilan bog‘lanishda xatolik yuz berdi.',
        raw: error?.message,
      };
    }
  }

  /**
   * Yangi tekshiruv (Deep Scan) yuborish
   */
  async submitScan(url: string): Promise<ScannerResult> {
    if (!this.apiKey) {
      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLSCAN_API_KEY sozlanmagan.',
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Key': this.apiKey,
        },
        body: JSON.stringify({
          url,
          visibility: 'unlisted', // 'private' faqat pullik hisoblarda to'liq ishlaydi, 'unlisted' tavsiya etiladi
        }),
        signal: AbortSignal.timeout(15000),
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          provider: 'urlscan',
          status: 'unknown',
          message: `URLScan yuborish xatosi: HTTP ${response.status}`,
          raw: responseText,
        };
      }

      const data = JSON.parse(responseText);

      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLScan chuqur tahlili qabul qilindi.',
        raw: data,
      };
    } catch (error: any) {
      console.error('❌ URLScan submit error:', error?.message || error);
      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLScan tahliliga yuborishda tarmoq xatosi.',
        raw: error?.message,
      };
    }
  }

  /**
   * Berilgan resultUrl bo'yicha tahlil yakunini olish
   */
  async getResult(resultUrl: string): Promise<ScannerResult> {
    if (!this.apiKey) {
      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLSCAN_API_KEY sozlanmagan.',
      };
    }

    try {
      const response = await fetch(resultUrl, {
        method: 'GET',
        headers: {
          'API-Key': this.apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      // Tahlil hali tugallanmagan bo'lsa URLScan 404 beradi
      if (response.status === 404) {
        return {
          provider: 'urlscan',
          status: 'unknown',
          message: 'URLScan tahlili hali davom etmoqda.',
          raw: { pending: true },
        };
      }

      if (!response.ok) {
        const responseText = await response.text();
        return {
          provider: 'urlscan',
          status: 'unknown',
          message: `URLScan natija xatosi: HTTP ${response.status}`,
          raw: responseText,
        };
      }

      const data = await response.json();
      const overall = data?.verdicts?.overall;
      const malicious = overall?.malicious === true || data?.verdicts?.engines?.maliciousTotal > 0;
      const score = overall?.score ?? 0;

      if (malicious) {
        return {
          provider: 'urlscan',
          status: 'dangerous',
          message: 'URLScan chuqur tahlilida havola xavfli deb topildi.',
          raw: data,
        };
      }

      if (score > 0) {
        return {
          provider: 'urlscan',
          status: 'suspicious',
          message: `URLScan shubhali faoliyat aniqladi (Xavf bali: ${score}).`,
          raw: data,
        };
      }

      return {
        provider: 'urlscan',
        status: 'safe',
        message: 'URLScan chuqur tahlilida tahdid aniqlanmadi.',
        raw: data,
      };
    } catch (error: any) {
      console.error('❌ URLScan getResult error:', error?.message || error);
      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLScan natijasini olishda xatolik yuz berdi.',
        raw: error?.message,
      };
    }
  }

  /**
   * Aqlli skanerlash: avval kesh qidiriladi, topilmasa yangi scan boshlanadi
   */
  async smartScan(url: string): Promise<ScannerResult> {
    const searchResult = await this.search(url);

    if (searchResult.status !== 'unknown') {
      return searchResult;
    }

    const submitResult = await this.submitScan(url);

    if (!submitResult.raw || typeof submitResult.raw !== 'object') {
      return submitResult;
    }

    const raw = submitResult.raw as { api?: string; result?: string; uuid?: string };
    const resultUrl = raw.api ?? raw.result;

    if (!resultUrl) {
      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLScan tahlili boshlandi, ammo natija havolasi olinmadi.',
        raw: submitResult.raw,
      };
    }

    return {
      provider: 'urlscan',
      status: 'unknown',
      message: 'URLScan chuqur tahlili boshlandi.',
      raw: {
        pending: true,
        resultUrl,
        uuid: raw.uuid ?? null,
      },
    };
  }

  /**
   * Natija tayyor bo'lguncha oraliq tekshiruv (polling)
   */
  async pollResult(resultUrl: string, maxAttempts = 10, delayMs = 3000): Promise<ScannerResult> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 URLScan polling: ${attempt}/${maxAttempts}`);

      const result = await this.getResult(resultUrl);

      if (result.raw && typeof result.raw === 'object' && (result.raw as any).pending !== true) {
        return result;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      provider: 'urlscan',
      status: 'unknown',
      message: 'URLScan tahlili hali tugamadi. Keyinroq tekshiring.',
      raw: {
        pending: true,
        resultUrl,
      },
    };
  }
}