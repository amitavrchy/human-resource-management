import { Controller, Get, Query } from '@nestjs/common';
import { CurrentActor, type Actor } from '../common/context.js';
import { PageDto } from '../common/dto.js';
import { ReportsService } from './reports.service.js';

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('dashboard') dashboard(@CurrentActor() a: Actor) { return this.reports.dashboard(a); }
  @Get('reports/headcount') headcount(@CurrentActor() a: Actor) { return this.reports.headcount(a); }
  @Get('reports/funnel') funnel(@CurrentActor() a: Actor) { return this.reports.funnel(a); }
  @Get('reports/leave') leave(@CurrentActor() a: Actor) { return this.reports.leave(a); }
  @Get('audit-logs') audit(@CurrentActor() a: Actor, @Query() q: PageDto) { return this.reports.audit(a, q); }
}
