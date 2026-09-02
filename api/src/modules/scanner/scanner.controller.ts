import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

import { GoogleSafeBrowsingScanner } from './providers/google-safe-browsing.scanner';
import { UrlhausScanner } from './providers/urlhaus.scanner';
import { VirusTotalScanner } from './providers/virustotal.scanner';
import { UrlscanScanner } from './providers/urlscan.scanner';
import { ScannerService } from './scanner.service';
import { RiskEngineService } from './risk/risk-engine.service';
import { ScannerResult } from './interfaces/scanner-result.interface';

// Multer tipi mavjud bo'lmaganda xatolik bermasligi uchun interfeys
interface UploadedFileType {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}

interface CheckUrlDto {
  url: string;
}

interface DeepScanDto {
  url: string;
  results?: ScannerResult[];
}

interface DeepScanStatusDto {
  resultUrl: string;
  results?: ScannerResult[];
}

interface CheckFileStatusDto {
  analysisId: string;
}

@Controller('scanner')
export class ScannerController {
  constructor(
    private readonly googleScanner: GoogleSafeBrowsingScanner,
    private readonly urlhausScanner: UrlhausScanner,
    private readonly virusTotalScanner: VirusTotalScanner,
    private readonly urlscanScanner: UrlscanScanner,
    private readonly scannerService: ScannerService,
    private readonly riskEngine: RiskEngineService,
  ) { }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  async check(@Body() body: CheckUrlDto) {
    if (!body?.url) {
      throw new BadRequestException('Tekshirish uchun URL yuborilmadi.');
    }

    const results = await this.scannerService.scanUrl(body.url, [
      this.googleScanner,
      this.urlhausScanner,
      this.virusTotalScanner,
    ]);

    const status = this.riskEngine.analyze(results);
    const score = this.riskEngine.calculateScore(results);
    const riskLevel = this.scannerService.getRiskLevel(score, status);

    return {
      url: body.url,
      status,
      risk: {
        score,
        level: riskLevel,
      },
      results,
    };
  }

  @Post('deep-scan')
  @HttpCode(HttpStatus.OK)
  async deepScan(@Body() body: DeepScanDto) {
    if (!body?.url) {
      throw new BadRequestException('URL ko‘rsatilmadi.');
    }

    const result = await this.scannerService.startUrlscanDeep(body.url);
    const raw =
      result.raw && typeof result.raw === 'object'
        ? (result.raw as { pending?: boolean; resultUrl?: string })
        : null;

    return {
      url: body.url,
      status: result.status,
      message: result.message,
      result,
      deepScan: {
        started: result.status === 'unknown' && raw?.pending === true,
        pending: raw?.pending === true,
        resultUrl: raw?.resultUrl ?? null,
      },
    };
  }

  @Post('deep-scan/status')
  @HttpCode(HttpStatus.OK)
  async deepScanStatus(@Body() body: DeepScanStatusDto) {
    if (!body?.resultUrl) {
      throw new BadRequestException('resultUrl parametri kiritilmadi.');
    }

    return this.scannerService.pollUrlscanDeep(
      body.resultUrl,
      body.results || [],
    );
  }

  @Post('file/check')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: './uploads',
      limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
      },
    }),
  )
  async checkFile(@UploadedFile() file: UploadedFileType) {
    if (!file) {
      throw new BadRequestException('Fayl yuklanmadi.');
    }

    console.log(`📱 Fayl qabul qilindi: ${file.originalname} (${file.size} bytes)`);

    try {
      const result = await this.scannerService.scanFile(file.path);

      return {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        ...result,
      };
    } finally {
      // Vaqtinchalik faylni server diskidan o'chirish
      if (file.path && existsSync(file.path)) {
        await fs.unlink(file.path).catch((err) => {
          console.error(`⚠️ Faylni tozalashda xatolik (${file.path}):`, err);
        });
      }
    }
  }

  @Post('file/check-status')
  @HttpCode(HttpStatus.OK)
  async checkFileStatus(@Body() body: CheckFileStatusDto) {
    if (!body?.analysisId) {
      throw new BadRequestException('analysisId parametri yuborilmadi.');
    }

    const result = await this.scannerService.checkFileAnalysis(body.analysisId);

    if (result.status === 'unknown') {
      return {
        analysisId: body.analysisId,
        status: 'unknown',
        pending: true,
        result,
      };
    }

    const score = this.riskEngine.calculateScore([result]);
    const level = this.riskEngine.getRiskLevel(score, result.status);

    return {
      analysisId: body.analysisId,
      status: result.status,
      pending: false,
      score,
      risk: {
        score,
        level,
      },
      message: result.message,
      result,
    };
  }
}