import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthStatus() {
    return {
      status: 'ok',
      service: 'CyberPosbon API',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}