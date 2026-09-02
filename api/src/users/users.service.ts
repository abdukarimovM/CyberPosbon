import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  private parseTelegramId(telegramId: string | number): bigint {
    try {
      return BigInt(telegramId);
    } catch {
      throw new BadRequestException('Yaroqsiz Telegram ID formati.');
    }
  }

  /**
   * Telegram foydalanuvchisini yaratadi yoki yangilaydi
   */
  async registerUser(data: {
    telegramId: string;
    username?: string;
    displayName?: string;
    language?: string;
  }) {
    const tid = this.parseTelegramId(data.telegramId);

    return this.prisma.user.upsert({
      where: {
        telegramId: tid,
      },
      update: {
        username: data.username,
        displayName: data.displayName,
        ...(data.language ? { language: data.language } : {}),
      },
      create: {
        telegramId: tid,
        username: data.username,
        displayName: data.displayName,
        language: data.language ?? 'uz_lat',
      },
    });
  }

  async updatePhoneNumber(telegramId: string, phoneNumber: string) {
    const tid = this.parseTelegramId(telegramId);

    return this.prisma.user.update({
      where: {
        telegramId: tid,
      },
      data: {
        phoneNumber,
      },
    });
  }

  async getUserByTelegramId(telegramId: string) {
    const tid = this.parseTelegramId(telegramId);

    return this.prisma.user.findUnique({
      where: {
        telegramId: tid,
      },
    });
  }

  async getUserCount() {
    return this.prisma.user.count();
  }

  async getAdminStats() {
    const totalUsers = await this.prisma.user.count();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayUsers = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    });

    const languageStats = await this.prisma.user.groupBy({
      by: ['language'],
      _count: {
        language: true,
      },
    });

    const languages: Record<string, number> = {};

    for (const item of languageStats) {
      languages[item.language ?? 'unknown'] = item._count.language;
    }

    return {
      totalUsers,
      todayUsers,
      languages,
    };
  }
}