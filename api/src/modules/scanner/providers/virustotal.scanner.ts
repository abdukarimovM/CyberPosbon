import { Injectable } from '@nestjs/common';
import { ScannerResult } from '../interfaces/scanner-result.interface';

@Injectable()
export class VirusTotalScanner {
  private readonly apiUrl = 'https://www.virustotal.com/api/v3';
  private readonly apiKey = process.env.VIRUSTOTAL_API_KEY;

  async scan(url: string): Promise<ScannerResult> {
    try {
      if (!this.apiKey) {
        return {
          provider: 'virustotal',
          status: 'unknown',
          message: 'VirusTotal API kaliti sozlanmagan.',
        };
      }

      /*
       * VirusTotal URL identifier (Base64 URL-safe, padding'siz)
       */
      const urlId = Buffer.from(url)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      /*
       * 1️⃣ Mavjud URL hisobotini tekshirish (API limitni tejash uchun)
       */
      const existingResponse = await fetch(`${this.apiUrl}/urls/${urlId}`, {
        method: 'GET',
        headers: {
          'x-apikey': this.apiKey,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (existingResponse.ok) {
        const data = await existingResponse.json();
        return this.parseResult(data);
      }

      if (existingResponse.status === 429) {
        return {
          provider: 'virustotal',
          status: 'unknown',
          message: 'VirusTotal so‘rovlar limiti tugagan (429).',
        };
      }

      /*
       * 2️⃣ Baza ichida topilmasa, yangi tahlilga yuboramiz
       */
      const form = new URLSearchParams();
      form.append('url', url);

      const scanResponse = await fetch(`${this.apiUrl}/urls`, {
        method: 'POST',
        headers: {
          'x-apikey': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!scanResponse.ok) {
        const errorText = await scanResponse.text();
        console.error('VirusTotal HTTP error:', scanResponse.status, errorText);

        return {
          provider: 'virustotal',
          status: 'unknown',
          message:
            scanResponse.status === 429
              ? 'VirusTotal API limiti oshib ketdi.'
              : `VirusTotal API xatosi: HTTP ${scanResponse.status}`,
          raw: errorText,
        };
      }

      const scanData = await scanResponse.json();
      const analysisId = scanData?.data?.id;

      if (!analysisId) {
        return {
          provider: 'virustotal',
          status: 'unknown',
          message: 'VirusTotal tahlil identifikatorini qaytarmadi.',
          raw: scanData,
        };
      }

      /*
       * 3️⃣ Tahlil yakunlanishini 3 soniya kutamiz
       */
      await this.sleep(3000);

      const analysisResponse = await fetch(
        `${this.apiUrl}/analyses/${analysisId}`,
        {
          method: 'GET',
          headers: {
            'x-apikey': this.apiKey,
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!analysisResponse.ok) {
        return {
          provider: 'virustotal',
          status: 'unknown',
          message: 'VirusTotal tahlili hali davom etmoqda.',
          raw: {
            analysisId,
            httpStatus: analysisResponse.status,
          },
        };
      }

      const analysisData = await analysisResponse.json();
      return this.parseAnalysisResult(analysisData);

    } catch (error: any) {
      console.error('VirusTotal scan error:', error?.message || error);

      return {
        provider: 'virustotal',
        status: 'unknown',
        message: 'VirusTotal bilan bog‘lanishda xatolik yuz berdi.',
        raw: error?.message,
      };
    }
  }

  private parseResult(data: any): ScannerResult {
    const stats = data?.data?.attributes?.last_analysis_stats;

    if (!stats) {
      return {
        provider: 'virustotal',
        status: 'unknown',
        message: 'VirusTotal tahlil maʼlumotlari topilmadi.',
        raw: data,
      };
    }

    return this.buildResult(stats, data);
  }

  private parseAnalysisResult(data: any): ScannerResult {
    const stats = data?.data?.attributes?.stats;

    if (!stats) {
      const status = data?.data?.attributes?.status;

      return {
        provider: 'virustotal',
        status: 'unknown',
        message:
          status === 'queued' || status === 'in-progress'
            ? 'VirusTotal tahlili hali davom etmoqda.'
            : 'VirusTotal tahlil natijasi topilmadi.',
        raw: data,
      };
    }

    return this.buildResult(stats, data);
  }

  private buildResult(stats: any, raw: any): ScannerResult {
    const malicious = Number(stats?.malicious || 0);
    const suspicious = Number(stats?.suspicious || 0);
    const harmless = Number(stats?.harmless || 0);
    const undetected = Number(stats?.undetected || 0);
    const total = malicious + suspicious + harmless + undetected;

    if (malicious > 0) {
      return {
        provider: 'virustotal',
        status: 'dangerous',
        message: `VirusTotal: ${malicious}/${total} ta tizim xavf aniqladi.`,
        raw: { stats, detections: `${malicious}/${total}`, full: raw },
      };
    }

    if (suspicious > 0) {
      return {
        provider: 'virustotal',
        status: 'suspicious',
        message: `VirusTotal: ${suspicious}/${total} ta tizim shubhali deb topdi.`,
        raw: { stats, detections: `${suspicious}/${total}`, full: raw },
      };
    }

    if (harmless > 0 || undetected > 0) {
      return {
        provider: 'virustotal',
        status: 'safe',
        message: 'VirusTotal: Xavf aniqlanmadi.',
        raw: { stats, full: raw },
      };
    }

    return {
      provider: 'virustotal',
      status: 'unknown',
      message: 'VirusTotal: Yetarli maʼlumot topilmadi.',
      raw,
    };
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}