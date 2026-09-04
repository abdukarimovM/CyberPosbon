import { Module } from '@nestjs/common';
import { PhoneController } from './phone.controller';
import { PhoneService } from './phone.service';
import { PhoneOsintService } from './phone-osint.service';
import { PhoneExportService } from './phone-export.service';

@Module({
    controllers: [PhoneController],
    providers: [PhoneService, PhoneOsintService, PhoneExportService],
    exports: [PhoneService, PhoneExportService],
})
export class PhoneModule { }