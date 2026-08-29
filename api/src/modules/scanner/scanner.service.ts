import { Injectable } from '@nestjs/common';
import { UrlscanScanner } from './providers/urlscan.scanner';

import { ScannerResult } from './interfaces/scanner-result.interface';

import { FileHashService } from './file/file-hash.service';
import { VirusTotalFileScanner } from './providers/virustotal-file.scanner';

import { RiskEngineService } from './risk/risk-engine.service';

@Injectable()
export class ScannerService {
  constructor(
    private readonly riskEngine: RiskEngineService,
    private readonly urlscanScanner: UrlscanScanner,
    private readonly fileHashService: FileHashService,
    private readonly virusTotalFileScanner: VirusTotalFileScanner,
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
      scan: (url: string) => Promise<ScannerResult>;
    }>,
  ): Promise<ScannerResult[]> {
    const results = await Promise.all(
      scanners.map(async (scanner): Promise<ScannerResult> => {
        try {
          return await scanner.scan(url);
        } catch (error) {
          console.error('Scanner error:', error);

          return {
            provider: 'unknown',
            status: 'unknown',
            message: 'Scanner ishlashida xatolik yuz berdi.',
          };
        }
      }),
    );

    return results;
  }

  /**
   * Scanner natijalaridan umumiy
   * xavf darajasini Risk Engine orqali aniqlaydi.
   */
  calculateStatus(results: ScannerResult[]): ScannerResult['status'] {
    return this.riskEngine.analyze(results);
  }

  /**
   * URLScan chuqur tahlilini BOSHLAYDI.
   *
   * Muhim:
   * - URLScan natijasini kutib turmaydi.
   * - Polling qilmaydi.
   * - Faqat scan boshlanganini va resultUrl'ni qaytaradi.
   */
  async startUrlscanDeep(url: string): Promise<ScannerResult> {
    try {
      console.log('🔬 URLScan deep scan boshlandi:', url);

      const smartResult = await this.urlscanScanner.smartScan(url);

      console.log('🔬 URLScan smart result:', smartResult.message);

      return smartResult;
    } catch (error) {
      console.error('❌ URLScan deep scan error:', error);

      return {
        provider: 'urlscan',
        status: 'unknown',
        message: 'Chuqur tahlilni boshlashda xatolik yuz berdi.',
        raw: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  /**
   * Tezkor scanner natijalariga
   * URLScan final natijasini qo‘shib,
   * yakuniy riskni hisoblaydi.
   */
  calculateFinalRisk(results: ScannerResult[], urlscanResult: ScannerResult) {
    const allResults = [...results, urlscanResult];

    const status = this.riskEngine.analyze(allResults);

    const score = this.riskEngine.calculateScore(allResults);

    const level = this.riskEngine.getRiskLevel(score, status);

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
   * URLScan chuqur tahlili natijasini oladi.
   *
   * Bu metod faqat foydalanuvchi
   * "Natijani tekshirish" tugmasini bosganda ishlaydi.
   */
  async pollUrlscanDeep(
    resultUrl: string,
    results: ScannerResult[] = [],
  ): Promise<{
    result: ScannerResult;
    finalRisk: {
      status: ScannerResult['status'];
      risk: {
        score: number;
        level: 'safe' | 'suspicious' | 'dangerous' | 'unknown';
      };
      results: ScannerResult[];
    };
  }> {
    try {
      console.log('🔄 URLScan deep result tekshirilmoqda:', resultUrl);

      const urlscanResult = await this.urlscanScanner.pollResult(resultUrl);

      console.log(
        '✅ URLScan result:',
        urlscanResult.status,
        urlscanResult.message,
      );

      const finalRisk = this.calculateFinalRisk(results, urlscanResult);

      console.log('🧠 FINAL RISK:', finalRisk);

      return {
        result: urlscanResult,
        finalRisk,
      };
    } catch (error) {
      console.error('❌ URLScan deep polling error:', error);

      const errorResult: ScannerResult = {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLScan natijasini olishda xatolik yuz berdi.',
        raw: {
          error: error instanceof Error ? error.message : String(error),
        },
      };

      const finalRisk = this.calculateFinalRisk(results, errorResult);

      return {
        result: errorResult,
        finalRisk,
      };
    }
  }

  /**
   * Umumiy risk score.
   */
  calculateScore(results: ScannerResult[]): number {
    return this.riskEngine.calculateScore(results);
  }

  /**
   * Score va umumiy status asosida
   * yakuniy risk darajasini aniqlaydi.
   */
  getRiskLevel(
    score: number,
    status: ScannerResult['status'],
  ): 'safe' | 'suspicious' | 'dangerous' | 'unknown' {
    return this.riskEngine.getRiskLevel(score, status);
  }

  async checkDeepScanResult(resultUrl: string): Promise<ScannerResult> {
    return this.urlscanScanner.getResult(resultUrl);
  }

  async scanFile(filePath: string) {
    // 1. SHA-256 hisoblash
    const sha256 = await this.fileHashService.calculateSha256(filePath);

    console.log('📱 File SHA-256:', sha256);

    // 2. VirusTotal bazasidan hash qidirish
    const report = await this.virusTotalFileScanner.getFileReport(sha256);

    // 3. Fayl VirusTotal bazasida mavjud
    if (report) {
      console.log('🦠 VirusTotal file report topildi');

      return {
        found: true,
        sha256,
        report,
      };
    }

    // 4. Fayl VirusTotal bazasida mavjud emas
    console.log('📭 VirusTotal bazasida fayl topilmadi');

    return {
      found: false,
      sha256,
      report: null,
    };
  }

  async checkFileAnalysis(analysisId: string): Promise<ScannerResult> {
    try {
      console.log('🔄 VirusTotal APK analysis tekshirilmoqda:', analysisId);

      const analysis = await this.virusTotalFileScanner.getAnalysis(analysisId);

      const status = analysis?.data?.attributes?.status;

      console.log('📱 VirusTotal analysis status:', status);

      // Hali tayyor emas
      if (status !== 'completed') {
        return {
          provider: 'virustotal-file',
          status: 'unknown',
          message: 'Fayl tahlili hali tugamadi.',
          raw: {
            analysisId,
            pending: true,
            analysisStatus: status,
          },
        };
      }

      // Tayyor natija
      const stats = analysis?.data?.attributes?.stats;

      const malicious = stats?.malicious ?? 0;

      const suspicious = stats?.suspicious ?? 0;

      let riskStatus: 'safe' | 'suspicious' | 'dangerous' | 'unknown' =
        'unknown';

      if (malicious > 0) {
        riskStatus = 'dangerous';
      } else if (suspicious > 0) {
        riskStatus = 'suspicious';
      } else if (stats) {
        riskStatus = 'safe';
      }

      return {
        provider: 'virustotal-file',
        status: riskStatus,
        message:
          riskStatus === 'dangerous'
            ? 'Faylda zararli faoliyat belgilari aniqlandi.'
            : riskStatus === 'suspicious'
              ? 'Faylda shubhali faoliyat belgilari aniqlandi.'
              : riskStatus === 'safe'
                ? 'Faylda zararli faoliyat aniqlanmadi.'
                : 'Fayl bo‘yicha yetarli ma’lumot mavjud emas.',
        raw: {
          analysisId,
          stats,
          analysis,
        },
      };
    } catch (error) {
      console.error('❌ File analysis check error:', error);

      return {
        provider: 'virustotal-file',
        status: 'unknown',
        message: 'Fayl tahlili natijasini olishda xatolik yuz berdi.',
        raw: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
