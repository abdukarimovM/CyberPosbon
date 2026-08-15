import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { SourceService } from './source.service';
import { CheckSourceDto } from './dto/check-source.dto';

@Controller('sources')
export class SourceController {
  constructor(
    private readonly sourceService: SourceService,
  ) {}

  @Post('check')
  async checkSource(
    @Body() dto: CheckSourceDto,
  ) {
    return this.sourceService.checkSource(
      dto.url,
    );
  }
}