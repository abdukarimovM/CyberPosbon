import { Injectable } from '@nestjs/common';
import { UrlscanScanner } from './providers/urlscan.scanner';
import { ScannerResult } from './interfaces/scanner-result.interface';
import { VirusTotalFileScanner } from './providers/virustotal-file.scanner';
import { RiskEngineService } from './risk/risk-engine.service';

@Injectable()
export class ScannerService {
  constructor(
    private readonly riskEngine: RiskEngineService,
    private readonly urlscanScanner: UrlscanScanner,
    private readonly virusTotalFileScanner: VirusTotalFileScanner,
  ) { }

  /**
   * Bir nechta URL scanner natijalarini parallel yig‘adi.
   */
  async scanUrl(
    url: string,
    scanners: Array<{
      scan: (url: string) => Promise<ScannerResult>;
    }>,
  ): Promise<ScannerResult[]> {
    return Promise.all(
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
  }

  calculateStatus(results: ScannerResult[]): ScannerResult['status'] {
    return this.riskEngine.analyze(results);
  }

  calculateScore(results: ScannerResult[]): number {
    return this.riskEngine.calculateScore(results);
  }

  getRiskLevel(
    score: number,
    status: ScannerResult['status'],
  ): 'safe' | 'suspicious' | 'dangerous' | 'unknown' {
    return this.riskEngine.getRiskLevel(score, status);
  }

  /**
   * URLScan chuqur tahlilini boshlash
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

      const finalRisk = this.calculateFinalRisk(results, urlscanResult);
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
   * Faylni (APK, EXE va b.) tekshirish
   */
  async scanFile(filePath: string) {
    console.log('📱 Fayl tekshiruvi boshlandi:', filePath);

    try {
      const result = await this.virusTotalFileScanner.scan(filePath);
      const score = this.riskEngine.calculateScore([result]);
      const level = this.riskEngine.getRiskLevel(score, result.status);

      const raw = result.raw && typeof result.raw === 'object' ? result.raw : {};
      const hasReport = 'report' in raw;
      const isPending = 'pending' in raw ? Boolean((raw as any).pending) : false;

      return {
        status: result.status,
        risk: {
          score,
          level,
        },
        score,
        found: hasReport,
        sha256: (raw as any)?.sha256 ?? null,
        message: result.message,
        report: (raw as any)?.report ?? null,
        analysisId: (raw as any)?.analysisId ?? null,
        pending: isPending,
        result,
      };
    } catch (error) {
      console.error('❌ File scan error:', error);
      return {
        status: 'unknown' as const,
        risk: {
          score: 0,
          level: 'unknown' as const,
        },
        score: 0,
        found: false,
        sha256: null,
        message: 'Faylni skanerlashda xatolik yuz berdi.',
        pending: false,
        result: {
          provider: 'virustotal-file',
          status: 'unknown' as const,
          message: 'Fayl skanerida kutilmagan xatolik.',
        },
      };
    }
  }

  /**
   * Asinxron fayl tahlili holatini olish
   */
  async checkFileAnalysis(analysisId: string): Promise<ScannerResult> {
    try {
      console.log('🔄 VirusTotal fayl tahlili tekshirilmoqda:', analysisId);
      const analysis = await this.virusTotalFileScanner.getAnalysis(analysisId);
      const status = analysis?.data?.attributes?.status;

      if (status !== 'completed') {
        return {
          provider: 'virustotal-file',
          status: 'unknown',
          message: 'Fayl tahlili hali davom etmoqda.',
          raw: {
            analysisId,
            pending: true,
            analysisStatus: status,
          },
        };
      }

      const stats = analysis?.data?.attributes?.stats;
      const malicious = stats?.malicious ?? 0;
      const suspicious = stats?.suspicious ?? 0;

      let riskStatus: 'safe' | 'suspicious' | 'dangerous' | 'unknown' = 'unknown';

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
            ? `Faylda xavf aniqlandi! (${malicious} ta antivirus xavfli deb topdi)`
            : riskStatus === 'suspicious'
              ? 'Faylda shubhali faoliyat aniqlandi.'
              : riskStatus === 'safe'
                ? 'Fayl toza deb topildi.'
                : 'Fayl bo‘yicha yetarli ma’lumot topilmadi.',
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