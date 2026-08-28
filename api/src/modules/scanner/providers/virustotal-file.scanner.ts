import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class VirusTotalFileScanner {
  private readonly apiUrl =
    'https://www.virustotal.com/api/v3';

  private readonly apiKey =
    process.env.VIRUSTOTAL_API_KEY;

  async getFileReport(
    sha256: string,
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error(
        'VIRUSTOTAL_API_KEY .env faylida topilmadi',
      );
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/files/${sha256}`,
        {
          headers: {
            'x-apikey': this.apiKey,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      if (
        error.response?.status === 404
      ) {
        return null;
      }

      throw error;
    }
  }
}