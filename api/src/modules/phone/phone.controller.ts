import {
    Body,
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Query,
    Res,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { PhoneService } from './phone.service';
import { PhoneExportService } from './phone-export.service';
import { FraudCategory } from '@prisma/client';

interface CheckPhoneDto {
    phoneNumber: string;
}

interface ReportPhoneDto {
    phoneNumber: string;
    reportedBy: string;
    category: FraudCategory;
    comment?: string;
}

interface VerifyPhoneDto {
    phoneNumber: string;
}

@Controller('phone')
export class PhoneController {
    constructor(
        private readonly phoneService: PhoneService,
        private readonly exportService: PhoneExportService,
    ) { }

    @Post('check')
    @HttpCode(HttpStatus.OK)
    async check(@Body() body: CheckPhoneDto) {
        return this.phoneService.checkNumber(body.phoneNumber);
    }

    @Post('report')
    @HttpCode(HttpStatus.OK)
    async report(@Body() body: ReportPhoneDto) {
        return this.phoneService.reportNumber(body);
    }

    // --- Admin / Moderator Endpointlari ---

    /**
     * So'nggi kelib tushgan shikoyatlar ro'yxatini olish
     * Misol: GET /phone/admin/reports?limit=10
     */
    @Get('admin/reports')
    async getPendingReports(@Query('limit') limit?: string) {
        const parsedLimit = limit ? parseInt(limit, 10) : 10;
        return this.phoneService.getPendingReports(parsedLimit);
    }

    /**
     * Raqamni rasman firibgar deb tasdiqlash (Qora ro'yxat)
     * Misol: PATCH /phone/admin/verify
     */
    @Patch('admin/verify')
    @HttpCode(HttpStatus.OK)
    async verifyNumber(@Body() body: VerifyPhoneDto) {
        return this.phoneService.verifyFraudNumber(body.phoneNumber);
    }

    /**
     * Soxta yoki noto'g'ri shikoyatni o'chirib tashlash
     * Misol: DELETE /phone/admin/report/:id
     */
    @Delete('admin/report/:id')
    @HttpCode(HttpStatus.OK)
    async dismissReport(@Param('id') id: string) {
        return this.phoneService.dismissReport(id);
    }

    // --- Eksport (Excel & Word) Endpointlari ---

    /**
     * Tasdiqlangan ma'lumotlar bazasini Excel formatida yuklash
     * Misol: GET /phone/admin/export/excel
     */
    @Get('admin/export/excel')
    async exportExcel(@Res() res: Response) {
        const buffer = await this.exportService.generateExcel();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="cyberposbon_threats.xlsx"',
            'Content-Length': buffer.length.toString(),
        });
        res.end(buffer);
    }

    /**
     * Rasmiy tahdidlar hisobotini Word (.docx) formatida yuklash
     * Misol: GET /phone/admin/export/word
     */
    @Get('admin/export/word')
    async exportWord(@Res() res: Response) {
        const buffer = await this.exportService.generateWord();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': 'attachment; filename="cyberposbon_report.docx"',
            'Content-Length': buffer.length.toString(),
        });
        res.end(buffer);
    }
}