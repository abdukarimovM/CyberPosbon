import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class VirusTotalFileScanner {
  private readonly apiUrl = 'https://www.virustotal.com/api/v3';

  private readonly apiKey = process.env.VIRUSTOTAL_API_KEY;

  async calculateSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');

      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  async scan(filePath: string): Promise<{
    provider: string;
    status: 'safe' | 'suspicious' | 'dangerous' | 'unknown';
    message: string;
    raw?: any;
  }> {
    try {
      console.log('🔍 VirusTotal APK tekshiruvi boshlandi');

      // 1️⃣ SHA-256 hisoblaymiz
      const sha256 = await this.calculateSha256(filePath);

      console.log('🔐 SHA-256:', sha256);

      // 2️⃣ VirusTotal bazasidan hashni qidiramiz
      const report = await this.getFileReport(sha256);

      // 3️⃣ VirusTotal bazasida mavjud
      if (report) {
        console.log('✅ VirusTotal: fayl bazada mavjud');

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
              ? 'VirusTotal faylda zararli faoliyat aniqladi.'
              : status === 'suspicious'
                ? 'VirusTotal faylni shubhali deb baholadi.'
                : status === 'safe'
                  ? 'VirusTotal faylda zararli faoliyat aniqlamadi.'
                  : 'VirusTotal fayl bo‘yicha yetarli ma’lumot bermadi.',
          raw: {
            sha256,
            stats,
            report,
          },
        };
      }

      // 4️⃣ Bazada mavjud emas — VirusTotal'ga yuklaymiz
      console.log(
        '📤 VirusTotal: fayl bazada topilmadi, upload boshlanmoqda...',
      );

      const analysisId = await this.uploadFile(filePath);

      return {
        provider: 'virustotal-file',
        status: 'unknown',
        message:
          'Fayl VirusTotal tahliliga yuborildi. Tahlil natijasi hali tayyor emas.',
        raw: {
          sha256,
          analysisId,
          pending: true,
        },
      };
    } catch (error) {
      console.error('❌ VirusTotal file scan error:', error);

      return {
        provider: 'virustotal-file',
        status: 'unknown',
        message: 'Faylni VirusTotal orqali tekshirishda xatolik yuz berdi.',
        raw: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

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

  async uploadFile(filePath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('VIRUSTOTAL_API_KEY .env faylida topilmadi');
    }

    try {
      console.log('📤 Fayl VirusTotal ga yuklanmoqda...');

      const FormData = (await import('form-data')).default;

      const form = new FormData();

      form.append('file', fs.createReadStream(filePath));

      const response = await axios.post(`${this.apiUrl}/files`, form, {
        headers: {
          'x-apikey': this.apiKey,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const analysisId = response.data?.data?.id;

      if (!analysisId) {
        throw new Error('VirusTotal analysis ID qaytarmadi.');
      }

      console.log('📤 VirusTotal analysis ID:', analysisId);

      return analysisId;
    } catch (error) {
      console.error('❌ VirusTotal file upload error:', error);

      throw error;
    }
  }

  async getAnalysis(analysisId: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('VIRUSTOTAL_API_KEY .env faylida topilmadi');
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/analyses/${analysisId}`,
        {
          headers: {
            'x-apikey': this.apiKey,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('❌ VirusTotal analysis olishda xatolik:', error);

      throw error;
    }
  }
}
