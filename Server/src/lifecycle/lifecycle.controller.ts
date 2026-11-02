import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentActor, type Actor } from '../common/context.js';
import { GoalDto, GoalProgressDto, ReviewDto, TaskDto } from '../common/dto.js';
import { LifecycleService } from './lifecycle.service.js';

@Controller()
export class LifecycleController {
  constructor(private readonly lifecycle: LifecycleService) {}
  @Get('onboarding') list(@CurrentActor() a: Actor) {
    return this.lifecycle.onboarding(a);
  }
  @Get('onboarding/:id') onboarding(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
  ) {
    return this.lifecycle.onboarding(a, id);
  }
  @Patch('onboarding/:id') task(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() d: TaskDto,
  ) {
    return this.lifecycle.task(a, id, d);
  }
  @Get('performance') performance(@CurrentActor() a: Actor) {
    return this.lifecycle.performance(a);
  }
  @Post('goals') goal(@CurrentActor() a: Actor, @Body() d: GoalDto) {
    return this.lifecycle.createGoal(a, d);
  }
  @Patch('goals/:id') progress(
    @CurrentActor() a: Actor,
    @Param('id') id: string,
    @Body() d: GoalProgressDto,
  ) {
    return this.lifecycle.progress(a, id, d);
  }
  @Post('reviews') review(@CurrentActor() a: Actor, @Body() d: ReviewDto) {
    return this.lifecycle.review(a, d);
  }
}
