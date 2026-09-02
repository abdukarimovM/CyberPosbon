import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { SourceModule } from './modules/source/source.module';
import { ScannerModule } from './modules/scanner/scanner.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    // Muhit o'zgaruvchilarini (.env) butun loyiha bo'ylab global qilish
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    SourceModule,
    ScannerModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }