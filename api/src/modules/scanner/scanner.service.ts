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
/**
 * URLScan'ni background rejimida ishlatadi.
 *
 * Foydalanuvchi URLScan tugashini kutmaydi.
 */
async startUrlscanBackground(
  url: string,
  results: ScannerResult[],
): Promise<ScannerResult | null> {
  try {
    console.log(
      '🔬 URLScan background scan boshlandi:',
      url,
    );

    // 1. Avval Search, topilmasa Submit
    const smartResult =
      await this.urlscanScanner.smartScan(url);

    console.log(
      '🔬 URLScan smart result:',
      smartResult.message,
    );

    /*
     * 2. Agar tayyor natija bo‘lsa
     * final Risk'ni darhol hisoblaymiz.
     */
    if (
      smartResult.status === 'safe' ||
      smartResult.status === 'suspicious' ||
      smartResult.status === 'dangerous'
    ) {
      const finalRisk =
        this.calculateFinalRisk(
          results,
          smartResult,
        );

      console.log(
        '🧠 FINAL RISK:',
        finalRisk,
      );

      return {
        ...smartResult,
        raw: {
          ...(typeof smartResult.raw === 'object' &&
          smartResult.raw !== null
            ? smartResult.raw
            : {}),
          finalRisk,
        },
      };
    }

    /*
     * 3. Yangi scan boshlangan bo‘lsa
     * background polling qilamiz.
     */
    if (
      smartResult.raw &&
      typeof smartResult.raw === 'object'
    ) {
      const raw =
        smartResult.raw as {
          pending?: boolean;
          resultUrl?: string;
        };

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

        /*
         * 4. URLScan final natijasini
         * boshqa scannerlarga qo‘shamiz.
         */
        const finalRisk =
          this.calculateFinalRisk(
            results,
            finalResult,
          );

        console.log(
          '🧠 FINAL RISK:',
          finalRisk,
        );

        /*
         * ScannerResult formatini saqlaymiz,
         * lekin finalRisk'ni raw ichida ham qaytaramiz.
         */
        return {
          ...finalResult,
          raw: {
            ...(typeof finalResult.raw === 'object' &&
            finalResult.raw !== null
              ? finalResult.raw
              : {}),
            finalRisk,
          },
        };
      }
    }

    /*
     * 5. Kutilmagan holat
     */
    console.log(
      '⚪ URLScan natijasi hozircha tayyor emas:',
      smartResult.status,
    );

    return smartResult;

  } catch (error) {
    console.error(
      '❌ URLScan background error:',
      error,
    );

    return null;
  }
}
/**
 * Tezkor scanner natijalariga
 * URLScan final natijasini qo‘shib,
 * yakuniy riskni hisoblaydi.
 */
calculateFinalRisk(
  results: ScannerResult[],
  urlscanResult: ScannerResult,
) {
  const allResults = [
    ...results,
    urlscanResult,
  ];

  const status =
  this.riskEngine.analyze(
    allResults,
  );

const score =
  this.riskEngine.calculateScore(
    allResults,
  );

const level =
  this.riskEngine.getRiskLevel(
    score,
    status,
  );

return {
  status,
  risk: {
    score,
    level,
  },
  results: allResults,
};
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
 * Score va umumiy status asosida
 * yakuniy risk darajasini aniqlaydi.
 */
getRiskLevel(
  score: number,
  status: ScannerResult['status'],
): 'safe' | 'suspicious' | 'dangerous' | 'unknown' {
  return this.riskEngine.getRiskLevel(
    score,
    status,
  );
}
}