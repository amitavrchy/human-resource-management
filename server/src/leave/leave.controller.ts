import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentActor, type Actor } from '../common/context.js';
import { LeaveDto } from '../common/dto.js';
import { LeaveService } from './leave.service.js';

@Controller()
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}
  @Get('leave-requests') list(@CurrentActor() a: Actor) {
    return this.leave.list(a);
  }
  @Get('leave-balances') balances(
    @CurrentActor() a: Actor,
    @Query('employeeId') id?: string,
    @Query('year') year?: string,
  ) {
    return this.leave.balances(a, id, year ? Number(year) : undefined);
  }
  @Post('leave-requests') create(
    @CurrentActor() a: Actor,
    @Body() d: LeaveDto,
  ) {
    return this.leave.create(a, d);
  }
  @Post('leave-requests/:id/approve') approve(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
  ) {
    return this.leave.decide(a, id, 'APPROVED');
  }
  @Post('leave-requests/:id/reject') reject(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
  ) {
    return this.leave.decide(a, id, 'REJECTED');
  }
  @Post('leave-requests/:id/cancel') cancel(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
  ) {
    return this.leave.decide(a, id, 'CANCELLED');
  }
}
