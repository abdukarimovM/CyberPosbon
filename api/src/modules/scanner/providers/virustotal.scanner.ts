import 'dotenv/config';

import { Injectable } from '@nestjs/common';

import {
  ScannerResult,
} from '../interfaces/scanner-result.interface';

@Injectable()
export class VirusTotalScanner {
  private readonly apiUrl =
    'https://www.virustotal.com/api/v3';

  private readonly apiKey =
    process.env.VIRUSTOTAL_API_KEY;

  async scan(
    url: string,
  ): Promise<ScannerResult> {
    try {
      if (!this.apiKey) {
        return {
          provider: 'virustotal',
          status: 'unknown',
          message:
            'VirusTotal API kaliti sozlanmagan.',
        };
      }

      /*
       * VirusTotal URL identifier
       *
       * API v3 URL uchun padding'siz
       * Base64 identifier qabul qiladi.
       */
      const urlId = Buffer.from(url)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      /*
       * Avval mavjud URL reportini qidiramiz.
       *
       * Bu har safar yangi scan yuborib,
       * API limitini bekorga ishlatmaslik uchun.
       */
      const existingResponse =
        await fetch(
          `${this.apiUrl}/urls/${urlId}`,
          {
            method: 'GET',
            headers: {
              'x-apikey': this.apiKey,
            },
          },
        );

      if (existingResponse.ok) {
        const data =
          await existingResponse.json();

        return this.parseResult(data);
      }

      /*
       * Agar VirusTotal'da URL mavjud bo'lmasa,
       * yangi scan yuboramiz.
       */
      const form = new URLSearchParams();

      form.append('url', url);

      const scanResponse =
        await fetch(
          `${this.apiUrl}/urls`,
          {
            method: 'POST',
            headers: {
              'x-apikey': this.apiKey,
              'Content-Type':
                'application/x-www-form-urlencoded',
            },
            body: form.toString(),
          },
        );

      if (!scanResponse.ok) {
        const errorText =
          await scanResponse.text();

        console.error(
          'VirusTotal HTTP error:',
          scanResponse.status,
          errorText,
        );

        return {
          provider: 'virustotal',
          status: 'unknown',
          message:
            `VirusTotal API xatosi: HTTP ${scanResponse.status}`,
          raw: errorText,
        };
      }

      const scanData =
        await scanResponse.json();

      const analysisId =
        scanData?.data?.id;

      if (!analysisId) {
        return {
          provider: 'virustotal',
          status: 'unknown',
          message:
            'VirusTotal analysis ID qaytarmadi.',
          raw: scanData,
        };
      }

      /*
       * Yangi scan darhol tayyor bo'lmasligi mumkin.
       * Bir necha soniya kutamiz va natijani olamiz.
       */
      await this.sleep(3000);

      const analysisResponse =
        await fetch(
          `${this.apiUrl}/analyses/${analysisId}`,
          {
            method: 'GET',
            headers: {
              'x-apikey': this.apiKey,
            },
          },
        );

      if (!analysisResponse.ok) {
        return {
          provider: 'virustotal',
          status: 'unknown',
          message:
            'VirusTotal tahlili hali tayyor emas.',
          raw: {
            analysisId,
            httpStatus:
              analysisResponse.status,
          },
        };
      }

      const analysisData =
        await analysisResponse.json();

      return this.parseAnalysisResult(
        analysisData,
      );
    } catch (error: any) {
      console.error(
        'VirusTotal error:',
        error?.message || error,
      );

      return {
        provider: 'virustotal',
        status: 'unknown',
        message:
          'VirusTotal bilan bog‘lanishda xatolik yuz berdi.',
        raw: error?.message,
      };
    }
  }

  private parseResult(
    data: any,
  ): ScannerResult {
    const stats =
      data?.data?.attributes
        ?.last_analysis_stats;

    if (!stats) {
      return {
        provider: 'virustotal',
        status: 'unknown',
        message:
          'VirusTotal tahlil maʼlumotlari topilmadi.',
        raw: data,
      };
    }

    return this.buildResult(
      stats,
      data,
    );
  }

  private parseAnalysisResult(
    data: any,
  ): ScannerResult {
    const stats =
      data?.data?.attributes?.stats;

    if (!stats) {
      const status =
        data?.data?.attributes?.status;

      return {
        provider: 'virustotal',
        status: 'unknown',
        message:
          status === 'queued' ||
          status === 'in-progress'
            ? 'VirusTotal tahlili davom etmoqda.'
            : 'VirusTotal natijasi topilmadi.',
        raw: data,
      };
    }

    return this.buildResult(
      stats,
      data,
    );
  }

  private buildResult(
    stats: any,
    raw: any,
  ): ScannerResult {
    const malicious =
      Number(stats?.malicious || 0);

    const suspicious =
      Number(stats?.suspicious || 0);

    const harmless =
      Number(stats?.harmless || 0);

    const undetected =
      Number(stats?.undetected || 0);

    /*
     * 🔴 Bir yoki undan ko'p security
     * engine malicious deb topgan bo'lsa.
     */
    if (malicious > 0) {
      return {
        provider: 'virustotal',
        status: 'dangerous',
        message:
          `VirusTotal ${malicious} ta zararli aniqlash qayd etdi.`,
        raw,
      };
    }

    /*
     * 🟡 Suspicious bo'lsa.
     */
    if (suspicious > 0) {
      return {
        provider: 'virustotal',
        status: 'suspicious',
        message:
          `VirusTotal ${suspicious} ta shubhali aniqlash qayd etdi.`,
        raw,
      };
    }

    /*
     * 🟢 Hech qanday zararli/shubhali
     * aniqlash bo'lmasa.
     */
    if (
      harmless > 0 ||
      undetected > 0
    ) {
      return {
        provider: 'virustotal',
        status: 'safe',
        message:
          'VirusTotal zararli tahdid aniqlamadi.',
        raw,
      };
    }

    return {
      provider: 'virustotal',
      status: 'unknown',
      message:
        'VirusTotal yetarli tahlil maʼlumoti bermadi.',
      raw,
    };
  }

  private sleep(
    milliseconds: number,
  ): Promise<void> {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );
  }
}