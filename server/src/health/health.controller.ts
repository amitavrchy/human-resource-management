import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Public() @Get('live') live() {
    return { status: 'ok', service: 'peopleos-api' };
  }
  @Public() @Get('ready') async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database is not ready.');
    }
  }
}
