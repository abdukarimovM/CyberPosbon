import { Injectable } from '@nestjs/common';

import {
  ScannerResult,
} from './interfaces/scanner-result.interface';

@Injectable()
export class ScannerService {
  /**
   * Barcha scannerlardan kelgan natijalarni birlashtiradi.
   */
  async scanUrl(
    url: string,
    scanners: Array<{
      scan: (
        url: string,
      ) => Promise<ScannerResult>;
    }>,
  ): Promise<ScannerResult[]> {
    const results: ScannerResult[] = [];

    for (const scanner of scanners) {
      try {
        const result = await scanner.scan(url);

        results.push(result);
      } catch (error) {
        console.error(
          'Scanner error:',
          error,
        );

        results.push({
          provider: 'unknown',
          status: 'unknown',
          message:
            'Scanner ishlashida xatolik yuz berdi.',
        });
      }
    }

    return results;
  }

  /**
   * Scanner natijalaridan umumiy holatni chiqaradi.
   *
   * Hozircha oddiy qoidalar:
   * - bittasi dangerous bo‘lsa → dangerous
   * - aks holda bittasi suspicious bo‘lsa → suspicious
   * - hammasi safe bo‘lsa → safe
   * - qolgan holatda → unknown
   *
   * Keyinchalik bu joyda alohida RiskEngine bo‘ladi.
   */
  calculateStatus(
    results: ScannerResult[],
  ): ScannerResult['status'] {
    if (
      results.some(
        (result) =>
          result.status === 'dangerous',
      )
    ) {
      return 'dangerous';
    }

    if (
      results.some(
        (result) =>
          result.status === 'suspicious',
      )
    ) {
      return 'suspicious';
    }

    if (
      results.length > 0 &&
      results.every(
        (result) =>
          result.status === 'safe',
      )
    ) {
      return 'safe';
    }

    return 'unknown';
  }
}