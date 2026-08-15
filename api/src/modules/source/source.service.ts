import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SourceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async checkSource(url: string) {
    const parsedUrl = new URL(url);

    const domain = parsedUrl.hostname
      .toLowerCase()
      .replace(/^www\./, '');

    const existingSource =
      await this.prisma.source.findUnique({
        where: {
          domain,
        },
      });

    if (existingSource) {
      return {
        found: true,
        source: existingSource,
      };
    }

    const source = await this.prisma.source.create({
      data: {
        url,
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