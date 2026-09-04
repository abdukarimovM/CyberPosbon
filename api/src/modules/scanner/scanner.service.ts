import { Injectable, Logger } from '@nestjs/common';
import { UrlscanScanner } from './providers/urlscan.scanner';
import { ScannerResult } from './interfaces/scanner-result.interface';
import { VirusTotalFileScanner } from './providers/virustotal-file.scanner';
import { RiskEngineService } from './risk/risk-engine.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);

  constructor(
    private readonly riskEngine: RiskEngineService,
    private readonly urlscanScanner: UrlscanScanner,
    private readonly virusTotalFileScanner: VirusTotalFileScanner,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Faqat xavfli yoki shubhali havolalarni Source jadvaliga yozish
   */
  private async saveMaliciousSourceIfThreat(
    targetUrl: string,
    level: 'safe' | 'suspicious' | 'dangerous' | 'unknown',
    score: number,
    detections: string[] = [],
  ): Promise<void> {
    if (level !== 'dangerous' && level !== 'suspicious') {
      return;
    }

    try {
      let domain = targetUrl;
      try {
        const parsed = new URL(
          targetUrl.startsWith('http') ? targetUrl : `http://${targetUrl}`
        );
        domain = parsed.hostname;
      } catch {
        // Agar URL parse bo'lmasa, o'zini saqlaymiz
      }

      const threatDescription = detections.length > 0
        ? detections.slice(0, 2).join('; ')
        : (level === 'dangerous' ? 'Zararli fishing yoki scam havola' : 'Shubhali havola');

      await this.prisma.source.upsert({
        where: { domain },
        update: {
          url: targetUrl,
          status: level === 'dangerous' ? 'malicious' : 'suspicious',
          reason: `${threatDescription} (Xavf: ${score}%)`,
          updatedAt: new Date(),
        },
        create: {
          domain,
          url: targetUrl,
          status: level === 'dangerous' ? 'malicious' : 'suspicious',
          reason: `${threatDescription} (Xavf: ${score}%)`,
        },
      });

      this.logger.log(`🛡 Xavfli havola ma'lumotlar bazasiga yozildi: ${domain}`);
    } catch (error) {
      this.logger.error('❌ Xavfli havolani bazaga saqlashda xatolik:', error);
    }
  }

  /**
   * Bir nechta URL scanner natijalarini parallel yig‘adi.
   */
  async scanUrl(
    url: string,
    scanners: Array<{
      scan: (url: string) => Promise<ScannerResult>;
    }>,
    language: string = 'uz_lat',
  ): Promise<{
    results: ScannerResult[];
    status: ScannerResult['status'];
    risk: {
      score: number;
      level: 'safe' | 'suspicious' | 'dangerous' | 'unknown';
    };
    aiSummary: string;
  }> {
    const results = await Promise.all(
      scanners.map(async (scanner): Promise<ScannerResult> => {
        try {
          return await scanner.scan(url);
        } catch (error) {
          this.logger.error('Scanner error:', error);
          return {
            provider: 'unknown',
            status: 'unknown',
            message: 'Scanner ishlashida xatolik yuz berdi.',
          };
        }
      }),
    );

    const status = this.calculateStatus(results);
    const score = this.calculateScore(results);
    const level = this.getRiskLevel(score, status);

    const detections = results
      .filter((r) => r.status === 'dangerous' || r.status === 'suspicious')
      .map((r) => `${r.provider}: ${r.message}`);

    // Xavfli bo'lsa darhol bazaga yozamiz
    await this.saveMaliciousSourceIfThreat(url, level, score, detections);

    let aiSummary = '';
    try {
      aiSummary = await this.aiService.explainThreat({
        target: url,
        type: 'url',
        riskLevel: level,
        riskScore: score,
        rawDetections: detections,
        language,
      });
    } catch (err) {
      this.logger.error('AI xulosasini olishda xatolik:', err);
      aiSummary = 'AI xulosasini shakllantirib bo‘lmadi.';
    }

    return {
      results,
      status,
      risk: {
        score,
        level,
      },
      aiSummary,
    };
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
      this.logger.log(`🔬 URLScan deep scan boshlandi: ${url}`);
      const smartResult = await this.urlscanScanner.smartScan(url);
      return smartResult;
    } catch (error) {
      this.logger.error('❌ URLScan deep scan error:', error);
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

  async calculateFinalRisk(
    results: ScannerResult[],
    urlscanResult: ScannerResult,
    targetUrl: string = '',
    language: string = 'uz_lat',
  ) {
    const allResults = [...results, urlscanResult];
    const status = this.riskEngine.analyze(allResults);
    const score = this.riskEngine.calculateScore(allResults);
    const level = this.riskEngine.getRiskLevel(score, status);

    const detections = allResults
      .filter((r) => r.status === 'dangerous' || r.status === 'suspicious')
      .map((r) => `${r.provider}: ${r.message}`);

    // Chuqur tahlil natijasida xavfli deb topilsa ham bazaga saqlaymiz
    if (targetUrl) {
      await this.saveMaliciousSourceIfThreat(targetUrl, level, score, detections);
    }

    let aiSummary = '';
    try {
      aiSummary = await this.aiService.explainThreat({
        target: targetUrl || 'Tekshirilgan havola',
        type: 'url',
        riskLevel: level,
        riskScore: score,
        rawDetections: detections,
        language,
      });
    } catch (err) {
      this.logger.error('AI izohida xatolik:', err);
      aiSummary = 'AI xulosasini shakllantirib bo‘lmadi.';
    }

    return {
      status,
      risk: {
        score,
        level,
      },
      results: allResults,
      aiSummary,
    };
  }

  async pollUrlscanDeep(
    resultUrl: string,
    results: ScannerResult[] = [],
    originalTargetUrl: string = '',
    language: string = 'uz_lat',
  ): Promise<{
    result: ScannerResult;
    finalRisk: {
      status: ScannerResult['status'];
      risk: {
        score: number;
        level: 'safe' | 'suspicious' | 'dangerous' | 'unknown';
      };
      results: ScannerResult[];
      aiSummary: string;
    };
  }> {
    try {
      this.logger.log(`🔄 URLScan deep result tekshirilmoqda: ${resultUrl}`);
      const urlscanResult = await this.urlscanScanner.pollResult(resultUrl);

      const finalRisk = await this.calculateFinalRisk(
        results,
        urlscanResult,
        originalTargetUrl,
        language,
      );
      return {
        result: urlscanResult,
        finalRisk,
      };
    } catch (error) {
      this.logger.error('❌ URLScan deep polling error:', error);
      const errorResult: ScannerResult = {
        provider: 'urlscan',
        status: 'unknown',
        message: 'URLScan natijasini olishda xatolik yuz berdi.',
        raw: {
          error: error instanceof Error ? error.message : String(error),
        },
      };

      const finalRisk = await this.calculateFinalRisk(
        results,
        errorResult,
        originalTargetUrl,
        language,
      );
      return {
        result: errorResult,
        finalRisk,
      };
    }
  }

  /**
   * Faylni (APK, EXE va b.) tekshirish
   */
  async scanFile(filePath: string, language: string = 'uz_lat') {
    this.logger.log(`📱 Fayl tekshiruvi boshlandi: ${filePath}`);

    try {
      const result = await this.virusTotalFileScanner.scan(filePath);
      const score = this.riskEngine.calculateScore([result]);
      const level = this.riskEngine.getRiskLevel(score, result.status);

      const raw = result.raw && typeof result.raw === 'object' ? result.raw : {};
      const hasReport = 'report' in raw;
      const isPending = 'pending' in raw ? Boolean((raw as any).pending) : false;

      const fileName = filePath.split('/').pop() || 'fayl';
      const detections = result.status === 'dangerous' || result.status === 'suspicious'
        ? [result.message]
        : [];

      let aiSummary = '';
      if (!isPending) {
        try {
          aiSummary = await this.aiService.explainThreat({
            target: fileName,
            type: 'file',
            riskLevel: level,
            riskScore: score,
            rawDetections: detections,
            language,
          });
        } catch (err) {
          this.logger.error('File AI tahlilida xatolik:', err);
          aiSummary = 'AI xulosasini shakllantirib bo‘lmadi.';
        }
      }

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
        aiSummary,
      };
    } catch (error) {
      this.logger.error('❌ File scan error:', error);
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
        aiSummary: 'Fayl xatosi tufayli AI tahlil qila olmadi.',
      };
    }
  }

  /**
   * Asinxron fayl tahlili holatini olish
   */
  async checkFileAnalysis(analysisId: string, fileName: string = 'fayl', language: string = 'uz_lat'): Promise<ScannerResult & { aiSummary?: string }> {
    try {
      this.logger.log(`🔄 VirusTotal fayl tahlili tekshirilmoqda: ${analysisId}`);
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

      const score = riskStatus === 'dangerous' ? 85 : riskStatus === 'suspicious' ? 45 : 0;
      const level = this.riskEngine.getRiskLevel(score, riskStatus);

      let aiSummary = '';
      try {
        aiSummary = await this.aiService.explainThreat({
          target: fileName,
          type: 'file',
          riskLevel: level,
          riskScore: score,
          rawDetections: malicious > 0 ? [`${malicious} ta antivirus zararli deb topdi`] : [],
          language,
        });
      } catch (err) {
        aiSummary = 'AI xulosasini shakllantirib bo‘lmadi.';
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
        aiSummary,
      };
    } catch (error) {
      this.logger.error('❌ File analysis check error:', error);
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