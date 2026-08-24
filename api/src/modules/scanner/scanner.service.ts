import { Injectable } from '@nestjs/common';
import { UrlscanScanner } from './providers/urlscan.scanner';

import {
  ScannerResult,
} from './interfaces/scanner-result.interface';

import { RiskEngineService } from './risk/risk-engine.service';

@Injectable()
export class ScannerService {
 constructor(
  private readonly riskEngine: RiskEngineService,
  private readonly urlscanScanner: UrlscanScanner,
) {}
  /**
   * Bir nechta scanner natijalarini yig‘adi.
   *
   * Muhim:
   * scannerlar ketma-ket emas,
   * parallel ishlaydi.
   */
  async scanUrl(
    url: string,
    scanners: Array<{
      scan: (
        url: string,
      ) => Promise<ScannerResult>;
    }>,
  ): Promise<ScannerResult[]> {
    const results = await Promise.all(
  scanners.map(
    async (
      scanner,
    ): Promise<ScannerResult> => {
      try {
        return await scanner.scan(url);
      } catch (error) {
        console.error(
          'Scanner error:',
          error,
        );

        return {
          provider: 'unknown',
          status: 'unknown',
          message:
            'Scanner ishlashida xatolik yuz berdi.',
        };
      }
    },
  ),
);

    return results;
  }

  /**
   * Scanner natijalaridan umumiy
   * xavf darajasini Risk Engine orqali aniqlaydi.
   */
  calculateStatus(
    results: ScannerResult[],
  ): ScannerResult['status'] {
    return this.riskEngine.analyze(
      results,
    );
  }

  /**
 * URLScan'ni background rejimida ishlatadi.
 *
 * Foydalanuvchi URLScan tugashini kutmaydi.
 */
async startUrlscanBackground(
  url: string,
): Promise<void> {
  try {
    console.log(
      '🔬 URLScan background scan boshlandi:',
      url,
    );

    // 1. Search yoki Submit
    const smartResult =
      await this.urlscanScanner.smartScan(url);

    console.log(
      '🔬 URLScan smart result:',
      smartResult.message,
    );

    /*
     * Agar Search orqali tayyor natija topilgan bo‘lsa,
     * polling kerak emas.
     */
    if (
      !smartResult.raw ||
      typeof smartResult.raw !== 'object'
    ) {
      return;
    }

    const raw =
      smartResult.raw as {
        pending?: boolean;
        resultUrl?: string;
      };

    /*
     * Yangi scan boshlangan bo‘lsa,
     * background polling boshlaymiz.
     */
    if (
      raw.pending === true &&
      raw.resultUrl
    ) {
      console.log(
        '⏳ URLScan polling boshlandi:',
        raw.resultUrl,
      );

      const finalResult =
        await this.urlscanScanner.pollResult(
          raw.resultUrl,
        );

      console.log(
        '✅ URLScan background natijasi:',
        finalResult.status,
        finalResult.message,
      );

      return;
    }

    console.log(
      '✅ URLScan tayyor natija berdi:',
      smartResult.status,
    );
  } catch (error) {
    console.error(
      '❌ URLScan background error:',
      error,
    );
  }
}

  /**
   * Umumiy risk score.
   */
  calculateScore(
    results: ScannerResult[],
  ): number {
    return this.riskEngine.calculateScore(
      results,
    );
  }

  /**
 * Score asosida risk darajasini aniqlaydi.
 */
getRiskLevel(
  score: number,
): 'safe' | 'suspicious' | 'dangerous' | 'unknown' {
  return this.riskEngine.getRiskLevel(
    score,
  );
}
}