import { Injectable } from '@nestjs/common';

import {
  ScannerResult,
} from '../interfaces/scanner-result.interface';

@Injectable()
export class RiskEngineService {
  /**
   * Scanner natijalaridan umumiy xavf holatini aniqlaydi.
   *
   * Qoidalar:
   *
   * 🔴 Bitta scanner dangerous desa
   *    → dangerous
   *
   * 🟡 Dangerous bo'lmasa, bittasi suspicious desa
   *    → suspicious
   *
   * ⚪ Bitta scanner unknown bo'lsa
   *    → unknown
   *
   * 🟢 FAQAT barcha scannerlar safe bo'lsa
   *    → safe
   *
   * ⚪ Natijalar bo'lmasa
   *    → unknown
   */
  analyze(
    results: ScannerResult[],
  ): ScannerResult['status'] {
    // 1. Bitta scanner dangerous desa
    if (
      results.some(
        (result) =>
          result.status === 'dangerous',
      )
    ) {
      return 'dangerous';
    }

    // 2. Bitta scanner suspicious desa
    if (
      results.some(
        (result) =>
          result.status === 'suspicious',
      )
    ) {
      return 'suspicious';
    }

    // 3. Bitta scanner unknown bo'lsa,
    // hali URL'ni to'liq safe deb aytmaymiz.
    if (
      results.some(
        (result) =>
          result.status === 'unknown',
      )
    ) {
      return 'unknown';
    }

    // 4. FAQAT barcha scannerlar safe bo'lsa
    if (
      results.length > 0 &&
      results.every(
        (result) =>
          result.status === 'safe',
      )
    ) {
      return 'safe';
    }

    // 5. Qolgan holatlar
    return 'unknown';
  }

  /**
   * Umumiy risk score.
   *
   * 🔴 dangerous  → +70
   * 🟡 suspicious → +40
   * ⚪ unknown    → +10
   * 🟢 safe       → +0
   *
   * Maksimum score = 100.
   */
  calculateScore(
    results: ScannerResult[],
  ): number {
    let score = 0;

    for (const result of results) {
      switch (result.status) {
        case 'dangerous':
          score += 70;
          break;

        case 'suspicious':
          score += 40;
          break;

        case 'unknown':
          score += 10;
          break;

        case 'safe':
          score += 0;
          break;

        default:
          score += 10;
          break;
      }
    }

    return Math.min(score, 100);
  }
/**
 * Umumiy status asosida yakuniy risk darajasini aniqlaydi.
 *
 * Yakuniy level doimo umumiy statusga mos keladi.
 */
getRiskLevel(
  score: number,
  status: ScannerResult['status'],
): 'safe' | 'suspicious' | 'dangerous' | 'unknown' {

  switch (status) {
    case 'dangerous':
      return 'dangerous';

    case 'suspicious':
      return 'suspicious';

    case 'unknown':
      return 'unknown';

    case 'safe':
      return 'safe';

    default:
      return 'unknown';
  }
}

}