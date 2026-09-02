import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Maʼlumotlar bazasiga (Prisma) muvaffaqiyatli ulandi.');
    } catch (error) {
      this.logger.error('❌ Maʼlumotlar bazasiga ulanishda xatolik:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Maʼlumotlar bazasi ulanishi uzildi.');
  }
}