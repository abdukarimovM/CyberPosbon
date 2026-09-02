import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SourceService } from './source.service';
import { CheckSourceDto } from './dto/check-source.dto';

@Controller('sources')
export class SourceController {
  constructor(private readonly sourceService: SourceService) { }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  async checkSource(@Body() dto: CheckSourceDto) {
    if (!dto?.url) {
      throw new BadRequestException('url parametri yuborilmadi.');
    }

    return this.sourceService.checkSource(dto.url);
  }
}