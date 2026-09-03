import { Module } from '@nestjs/common';
import { PhoneService } from './phone.service';
import { PhoneController } from './phone.controller';
import { PhoneOsintService } from './phone-osint.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PhoneController],
    providers: [PhoneService, PhoneOsintService],
    exports: [PhoneService],
})
export class PhoneModule { }