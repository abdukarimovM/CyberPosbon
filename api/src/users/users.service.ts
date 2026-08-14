import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  
  /**
   * Telegram foydalanuvchisini yaratadi yoki mavjud bo'lsa yangilaydi.
   */
  async registerUser(data: {
    telegramId: string;
    username?: string;
    displayName?: string;
    language?: string;
  }) {
    return this.prisma.user.upsert({
      where: {
        telegramId: BigInt(data.telegramId),
      },

      update: {
        username: data.username,
        displayName: data.displayName,
        language: data.language ?? 'uz_lat',
      },

      create: {
        telegramId: BigInt(data.telegramId),
        username: data.username,
        displayName: data.displayName,
        language: data.language ?? 'uz_lat',
      },
    });
  }

  async updatePhoneNumber(
  telegramId: string,
  phoneNumber: string,
) {
  return this.prisma.user.update({
    where: {
      telegramId: BigInt(telegramId),
    },
    data: {
      phoneNumber,
    },
  });
}

  
  async getUserByTelegramId(telegramId: string) {
  return this.prisma.user.findUnique({
    where: {
      telegramId: BigInt(telegramId),
    },
  });
}


  /**
   * Botdan foydalanayotgan jami foydalanuvchilar soni.
   * Keyinchalik faqat admin panelda ishlatamiz.
   */
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