import { Injectable } from '@nestjs/common';
import { ScannerResult } from '../interfaces/scanner-result.interface';

export type RiskLevel = 'safe' | 'suspicious' | 'dangerous' | 'unknown';

@Injectable()
export class RiskEngineService {
  /**
   * Scanner natijalaridan umumiy xavf holatini aniqlaydi.
   *
   * Mantiq:
   * 🔴 Kamida bitta scanner 'dangerous' desa → dangerous
   * 🟡 Kamida bitta scanner 'suspicious' desa → suspicious
   * 🟢 Aniq tekshiruvlar mavjud bo'lib, xavf topilmasa → safe
   * ⚪ Hech qanday natija bo'lmasa yoki barcha skanerlar xato bersa → unknown
   */
  analyze(results: ScannerResult[]): RiskLevel {
    if (!results || results.length === 0) {
      return 'unknown';
    }

    // 1. Kamida bitta tizim xavfli deb topsa
    const hasDangerous = results.some((r) => r.status === 'dangerous');
    if (hasDangerous) {
      return 'dangerous';
    }

    // 2. Shubhali belgilar mavjud bo'lsa
    const hasSuspicious = results.some((r) => r.status === 'suspicious');
    if (hasSuspicious) {
      return 'suspicious';
    }

    // 3. Kamida bitta skaner aniq 'safe' qaytargan va xavf aniqlanmagan bo'lsa
    const safeCount = results.filter((r) => r.status === 'safe').length;
    const unknownCount = results.filter((r) => r.status === 'unknown').length;

    if (safeCount > 0 && safeCount >= unknownCount) {
      return 'safe';
    }

    // 4. Barcha skanerlar ma'lumot bera olmagan bo'lsa
    return 'unknown';
  }

  /**
   * Umumiy xavf ballini (0 dan 100 gacha) hisoblaydi.
   */
  calculateScore(results: ScannerResult[]): number {
    if (!results || results.length === 0) {
      return 0;
    }

    let totalScore = 0;

    for (const result of results) {
      switch (result.status) {
        case 'dangerous':
          totalScore += 75;
          break;
        case 'suspicious':
          totalScore += 40;
          break;
        case 'safe':
        case 'unknown':
        default:
          totalScore += 0;
          break;
      }
    }

    // 100 ball bilan cheklaymiz
    return Math.min(totalScore, 100);
  }

  /**
   * Ball va umumiy status asosida yakuniy xavf darajasini belgilaydi.
   */
  getRiskLevel(score: number, status: ScannerResult['status']): RiskLevel {
    // Agar status aniq dangerous bo'lsa yoki ball 70 dan yuqori bo'lsa
    if (status === 'dangerous' || score >= 70) {
      return 'dangerous';
    }

    // Agar status suspicious bo'lsa yoki ball 35-69 oralig'ida bo'lsa
    if (status === 'suspicious' || score >= 35) {
      return 'suspicious';
    }

    // Agar aniq safe bo'lsa va ball 0 bo'lsa
    if (status === 'safe') {
      return 'safe';
    }

    return 'unknown';
  }
}