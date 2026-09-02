import { Injectable } from '@nestjs/common';
import { google, safebrowsing_v5 } from 'googleapis';
import { ScannerResult } from '../interfaces/scanner-result.interface';

@Injectable()
export class GoogleSafeBrowsingScanner {
  private readonly apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  private readonly client: safebrowsing_v5.Safebrowsing;

  constructor() {
    this.client = google.safebrowsing({
      version: 'v5',
    });
  }

  async scan(url: string): Promise<ScannerResult> {
    if (!this.apiKey) {
      return {
        provider: 'google-safe-browsing',
        status: 'unknown',
        message: 'GOOGLE_SAFE_BROWSING_API_KEY topilmadi.',
      };
    }

    try {
      const response = await this.client.urls.search({
        key: this.apiKey,
        urls: [url],
      });

      const threats = response.data.threats ?? [];

      // 1. Tahdid topilmadi (Toza)
      if (threats.length === 0) {
        return {
          provider: 'google-safe-browsing',
          status: 'safe',
          message: 'Google Safe Browsing: Maʼlum tahdidlar aniqlanmadi.',
          raw: response.data,
        };
      }

      // 2. Tahdid turlarini ajratish
      const rawCategories: string[] = [
        ...new Set(
          threats.flatMap((threat) =>
            (threat.threatTypes ?? []).filter(
              (item): item is string => typeof item === 'string',
            ),
          ),
        ),
      ];

      // Kategoriya nomlarini inson tushunadigan holatga keltirish
      const translatedCategories = rawCategories.map((type) => {
        switch (type.toUpperCase()) {
          case 'MALWARE':
            return 'Zararli dastur (Malware)';
          case 'SOCIAL_ENGINEERING':
            return 'Fishing / Firibgarlik (Social Engineering)';
          case 'UNWANTED_SOFTWARE':
            return 'Keraksiz zararli dasturiy taʼminot';
          default:
            return type;
        }
      });

      const threatList = translatedCategories.join(', ');

      return {
        provider: 'google-safe-browsing',
        status: 'dangerous',
        categories: rawCategories,
        message: `Google Safe Browsing: Xavf aniqlandi! (${threatList})`,
        raw: response.data,
      };

    } catch (error: any) {
      console.error(
        '❌ Google Safe Browsing error:',
        error?.response?.data || error?.message || error,
      );

      return {
        provider: 'google-safe-browsing',
        status: 'unknown',
        message: 'Google Safe Browsing tekshiruvida xatolik yuz berdi.',
        raw: error?.response?.data || error?.message,
      };
    }
  }
}