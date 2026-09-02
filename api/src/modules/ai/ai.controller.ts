import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('explain')
    @HttpCode(HttpStatus.OK)
    async explain(@Body() body: {
        target: string;
        type: 'file' | 'url';
        riskLevel: string;
        riskScore: number;
        rawDetections?: string[];
        language?: string;
    }) {
        const explanation = await this.aiService.explainThreat(body);
        return { success: true, explanation };
    }

    @Post('chat')
    @HttpCode(HttpStatus.OK)
    async chat(@Body() body: {
        userId: string;
        message: string;
        language?: string;
    }) {
        const reply = await this.aiService.chat(body.userId, body.message, body.language);
        return { success: true, reply };
    }

    @Post('clear')
    @HttpCode(HttpStatus.OK)
    clear(@Body() body: { userId: string }) {
        this.aiService.clearHistory(body.userId);
        return { success: true };
    }
}