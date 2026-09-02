import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import FormData from 'form-data';
import { FileHashService } from '../file/file-hash.service';

export interface VirusTotalFileResult {
  provider: string;
  status: 'safe' | 'suspicious' | 'dangerous' | 'unknown';
  message: string;
  raw?: any;
}

@Injectable()
export class VirusTotalFileScanner {
  private readonly apiUrl = 'https://www.virustotal.com/api/v3';
  private readonly apiKey = process.env.VIRUSTOTAL_API_KEY;

  constructor(private readonly fileHashService: FileHashService) { }

  /**
   * Faylni to'liq tekshirish (Hash -> Qidiruv -> Zarur bo'lsa Upload)
   */
  async scan(filePath: string): Promise<VirusTotalFileResult> {
    try {
      console.log('🔍 VirusTotal fayl tekshiruvi boshlandi');

      // 1. Fayldan SHA-256 xesh olamiz
      const sha256 = await this.fileHashService.calculateSha256(filePath);
      console.log('🔐 Fayl SHA-256:', sha256);

      // 2. Xesh orqali bazadan qidiramiz
      const report = await this.getFileReport(sha256);

      // 3. Agar fayl bazada mavjud bo'lsa (Tezkor natija)
      if (report) {
        console.log('✅ VirusTotal: Fayl allaqachon bazada mavjud');

        const stats = report?.data?.attributes?.last_analysis_stats;
        const malicious = stats?.malicious ?? 0;
        const suspicious = stats?.suspicious ?? 0;

        let status: 'safe' | 'suspicious' | 'dangerous' | 'unknown' = 'unknown';

        if (malicious > 0) {
          status = 'dangerous';
        } else if (suspicious > 0) {
          status = 'suspicious';
        } else if (stats) {
          status = 'safe';
        }

        return {
          provider: 'virustotal-file',
          status,
          message:
            status === 'dangerous'
              ? `VirusTotal: ${malicious} ta antivirus xavf aniqladi.`
              : status === 'suspicious'
                ? 'VirusTotal: Shubhali faoliyat aniqlandi.'
                : status === 'safe'
                  ? 'VirusTotal: Zararli faoliyat aniqlanmadi.'
                  : 'VirusTotal fayl bo‘yicha yetarli ma’lumot bermadi.',
          raw: {
            sha256,
            stats,
            report,
          },
        };
      }

      // 4. Bazada mavjud bo'lmasa -> Upload
      console.log('📤 VirusTotal: Fayl bazada yo‘q, yuklash boshlanmoqda...');
      const analysisId = await this.uploadFile(filePath);

      return {
        provider: 'virustotal-file',
        status: 'unknown',
        message: 'Fayl VirusTotal tahliliga yuborildi. Tahlil hali davom etmoqda.',
        raw: {
          sha256,
          analysisId,
          pending: true,
        },
      };

    } catch (error: any) {
      console.error('❌ VirusTotal file scan error:', error?.response?.data || error?.message || error);

      const isRateLimit = error?.response?.status === 429;

      return {
        provider: 'virustotal-file',
        status: 'unknown',
        message: isRateLimit
          ? 'VirusTotal API so‘rovlar limiti tugadi (Birozdan so‘ng qayta urinib ko‘ring).'
          : 'Faylni VirusTotal orqali tekshirishda xatolik yuz berdi.',
        raw: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * SHA-256 orqali tayyor hisobotni olish
   */
  async getFileReport(sha256: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('VIRUSTOTAL_API_KEY .env faylida topilmadi');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/files/${sha256}`, {
        headers: {
          'x-apikey': this.apiKey,
        },
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Faylni VirusTotal serveriga yuklash
   */
  async uploadFile(filePath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('VIRUSTOTAL_API_KEY .env faylida topilmadi');
    }

    try {
      const fileStats = await fsPromises.stat(filePath);
      const fileSize = fileStats.size;
      const MAX_DIRECT_UPLOAD = 32 * 1024 * 1024; // 32 MB

      let uploadUrl = `${this.apiUrl}/files`;

      // 32 MB dan katta bo'lsa maxsus upload URL olamiz
      if (fileSize > MAX_DIRECT_UPLOAD) {
        console.log('📦 Fayl 32 MB dan katta, maxsus upload URL olinmoqda...');
        const uploadUrlResponse = await axios.get(`${this.apiUrl}/files/upload_url`, {
          headers: {
            'x-apikey': this.apiKey,
          },
        });

        uploadUrl = uploadUrlResponse.data?.data;
        if (!uploadUrl) {
          throw new Error('VirusTotal katta fayl yuklash uchun URL qaytarmadi.');
        }
      }

      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      const response = await axios.post(uploadUrl, form, {
        headers: {
          'x-apikey': this.apiKey,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 10 * 60 * 1000,
      });

      const analysisId = response.data?.data?.id;
      if (!analysisId) {
        throw new Error('VirusTotal analysis ID qaytarmadi.');
      }

      return analysisId;
    } catch (error: any) {
      console.error('❌ VirusTotal file upload error:', error?.response?.data || error?.message || error);
      throw error;
    }
  }

  /**
   * Yuborilgan faylning tahlil holatini olish
   */
  async getAnalysis(analysisId: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('VIRUSTOTAL_API_KEY .env faylida topilmadi');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/analyses/${analysisId}`, {
        headers: {
          'x-apikey': this.apiKey,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ VirusTotal analysis olish xatosi:', error?.response?.data || error?.message || error);
      throw error;
    }
  }
}