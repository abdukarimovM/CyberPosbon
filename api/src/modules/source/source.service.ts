import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SourceService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Havoladan toza domenni ajratib olish (protokolsiz va www-siz)
   */
  private extractDomain(rawUrl: string): { domain: string; cleanUrl: string } {
    try {
      // Agar protokol bo'lmasa, new URL xato bermasligi uchun https:// qo'shamiz
      const normalizedUrl = /^https?:\/\//i.test(rawUrl)
        ? rawUrl
        : `https://${rawUrl}`;

      const parsed = new URL(normalizedUrl);
      const domain = parsed.hostname.toLowerCase().replace(/^www\./, '');

      return { domain, cleanUrl: normalizedUrl };
    } catch {
      throw new BadRequestException('Kiritilgan URL manzili yaroqsiz formatda.');
    }
  }

  async checkSource(url: string) {
    if (!url || typeof url !== 'string') {
      throw new BadRequestException('URL ko‘rsatilmadi.');
    }

    const { domain, cleanUrl } = this.extractDomain(url.trim());

    // 1. Avval mavjud domenni tekshiramiz
    const existingSource = await this.prisma.source.findUnique({
      where: { domain },
    });

    if (existingSource) {
      return {
        found: true,
        source: existingSource,
      };
    }

    // 2. Mavjud bo'lmasa, xavfsiz upsert orqali yaratamiz (Race Condition xavfisiz)
    const source = await this.prisma.source.upsert({
      where: { domain },
      update: {},
      create: {
        url: cleanUrl,
        domain,
        status: 'unknown',
        reason: 'Manba hali bazada baholanmagan.',
      },
    });

    return {
      found: false,
      source,
    };
  }
}