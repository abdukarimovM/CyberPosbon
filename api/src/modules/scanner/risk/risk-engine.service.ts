import { Injectable } from '@nestjs/common';

import {
  ScannerResult,
} from '../interfaces/scanner-result.interface';

@Injectable()
export class RiskEngineService {
  /**
   * Scanner natijalaridan umumiy xavf darajasini aniqlaydi.
   *
   * Qoidalar:
   *
   * 🔴 Bitta scanner dangerous desa
   *    → dangerous
   *
   * 🟡 Dangerous bo'lmasa, bittasi suspicious desa
   *    → suspicious
   *
   * 🟢 Kamida bitta scanner bo'lsa va
   *    barcha mavjud natijalar safe bo'lsa
   *    → safe
   *
   * ⚪ Yetarli ma'lumot bo'lmasa
   *    → unknown
   */
  analyze(
    results: ScannerResult[],
  ): ScannerResult['status'] {
    if (results.length === 0) {
      return 'unknown';
    }

    // 🔴 1. Kuchli xavf
    if (
      results.some(
        (result) =>
          result.status === 'dangerous',
      )
    ) {
      return 'dangerous';
    }

    // 🟡 2. Shubhali
    if (
      results.some(
        (result) =>
          result.status === 'suspicious',
      )
    ) {
      return 'suspicious';
    }

    /*
     * ⚪ Unknown / no_data natijalar
     * xavfli deb hisoblanmaydi.
     *
     * Masalan:
     * Google      → safe
     * URLhaus     → unknown
     * VirusTotal  → safe
     *
     * Bu holat SAFE bo'lishi mumkin.
     */
    const knownResults =
      results.filter(
        (result) =>
          result.status === 'safe',
      );

    if (
      knownResults.length > 0 &&
      knownResults.length ===
        results.filter(
          (result) =>
            result.status === 'safe' ||
            result.status === 'unknown',
        ).length
    ) {
      return 'safe';
    }

    return 'unknown';
  }

  /**
   * Risk score.
   *
   * dangerous  → +70
   * suspicious → +40
   * safe       → +0
   * unknown    → +0
   *
   * Unknown xavf ballini oshirmaydi.
   */
  calculateScore(
    results: ScannerResult[],
  ): number {
    let score = 0;

    for (const result of results) {
      if (
        result.status === 'dangerous'
      ) {
        score += 70;
      }

      if (
        result.status === 'suspicious'
      ) {
        score += 40;
      }

      // safe → 0
      // unknown → 0
    }

    return Math.min(score, 100);
  }

  /**
   * Score asosida umumiy risk darajasi.
   */
  getRiskLevel(
    score: number,
  ): 'safe' | 'suspicious' | 'dangerous' {
    if (score >= 61) {
      return 'dangerous';
    }

    if (score >= 21) {
      return 'suspicious';
    }

    return 'safe';
  }
}