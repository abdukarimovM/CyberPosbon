import { Injectable } from '@nestjs/common';

import {
  ScannerResult,
} from '../interfaces/scanner-result.interface';

@Injectable()
export class RiskEngineService {
  analyze(
    results: ScannerResult[],
  ): ScannerResult['status'] {
    // 🔴 1. Bitta scanner ham dangerous desa,
    // umumiy natija dangerous.
    if (
      results.some(
        (result) =>
          result.status === 'dangerous',
      )
    ) {
      return 'dangerous';
    }

    // 🟡 2. Bitta scanner suspicious desa,
    // umumiy natija suspicious.
    if (
      results.some(
        (result) =>
          result.status === 'suspicious',
      )
    ) {
      return 'suspicious';
    }

    // 🟢 3. Barcha scannerlar safe desa,
    // faqat shunda safe.
    if (
      results.length > 0 &&
      results.every(
        (result) =>
          result.status === 'safe',
      )
    ) {
      return 'safe';
    }

    // ⚪ 4. Aralash yoki yetarli ma'lumot bo'lmasa
    // unknown.
    return 'unknown';
  }

  calculateScore(
    results: ScannerResult[],
  ): number {
    let score = 0;

    for (const result of results) {
      if (result.status === 'dangerous') {
        score += 70;
      }

      if (result.status === 'suspicious') {
        score += 40;
      }

      if (result.status === 'unknown') {
        score += 10;
      }
    }

    // Maksimum 100
    return Math.min(score, 100);
  }

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