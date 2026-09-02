import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { PhoneService } from './phone.service';
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

@Controller('phone')
export class PhoneController {
    constructor(private readonly phoneService: PhoneService) { }

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
}