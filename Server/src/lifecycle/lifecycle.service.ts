import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../common/access.service.js';
import { type Actor } from '../common/context.js';
import { GoalDto, GoalProgressDto, ReviewDto, TaskDto } from '../common/dto.js';
import { dateOnly, serializable } from '../common/database.js';
import { employeeSelect } from '../people/people.service.js';

@Injectable()
export class LifecycleService {
  constructor(private readonly db: PrismaService, private readonly access: AccessService) {}
  async onboarding(actor: Actor, employeeId?: string) {
    if (employeeId) await this.access.employee(actor, employeeId);
    return this.db.employee.findMany({ where: { ...(await this.access.employeeWhere(actor)), ...(employeeId ? { id: employeeId } : { status: 'ONBOARDING' }) }, select: { ...employeeSelect, onboardingTasks: { orderBy: { sortOrder: 'asc' } } }, orderBy: { startDate: 'desc' }, take: 200 });
  }
  async task(actor: Actor, employeeId: string, dto: TaskDto) {
    await this.access.employee(actor, employeeId);
    return serializable(this.db, async tx => {
      const task = await tx.onboardingTask.findFirst({ where: { id: dto.taskId, employeeId, organizationId: actor.organizationId } });
      if (!task) throw new NotFoundException('Onboarding task not found.');
      await tx.onboardingTask.update({ where: { id: task.id, organizationId: actor.organizationId }, data: { status: dto.status } });
      const remaining = await tx.onboardingTask.count({ where: { employeeId, organizationId: actor.organizationId, status: { not: 'DONE' } } });
      if (!remaining) await tx.employee.updateMany({ where: { id: employeeId, organizationId: actor.organizationId, status: 'ONBOARDING' }, data: { status: 'ACTIVE' } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'onboarding.task_updated', entityType: 'OnboardingTask', entityId: task.id, metaJson: { status: dto.status } } });
      return { success: true, remaining };
    });
  }
  async performance(actor: Actor) {
    const ids = await this.access.employeeIds(actor);
    const where = { organizationId: actor.organizationId, ...(ids ? { employeeId: { in: ids } } : {}) };
    const [goals, reviews] = await Promise.all([
      this.db.goal.findMany({ where, include: { employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 300 }),
      this.db.review.findMany({ where, include: { employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return { goals, reviews };
  }
  async createGoal(actor: Actor, dto: GoalDto) {
    await this.access.employee(actor, dto.employeeId);
    return this.db.$transaction(async tx => {
      const goal = await tx.goal.create({ data: { employeeId: dto.employeeId, title: dto.title, organizationId: actor.organizationId, dueDate: dto.dueDate ? dateOnly(dto.dueDate) : undefined } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'goal.created', entityType: 'Goal', entityId: goal.id } });
      return goal;
    });
  }
  async progress(actor: Actor, id: string, dto: GoalProgressDto) {
    const goal = await this.db.goal.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!goal) throw new NotFoundException('Goal not found.');
    await this.access.employee(actor, goal.employeeId);
    return this.db.$transaction(async tx => {
      const updated = await tx.goal.update({ where: { id, organizationId: actor.organizationId }, data: dto });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'goal.progress_updated', entityType: 'Goal', entityId: id, metaJson: { progress: dto.progress } } });
      return updated;
    });
  }
  async review(actor: Actor, dto: ReviewDto) {
    await this.access.employee(actor, dto.employeeId);
    const year = Number(dto.quarter.slice(0, 4));
    if (year < 2000 || year > new Date().getUTCFullYear() + 1) throw new BadRequestException('Choose a valid review quarter.');
    return this.db.$transaction(async tx => {
      const review = await tx.review.create({ data: { ...dto, organizationId: actor.organizationId, authorUserId: actor.userId } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'review.submitted', entityType: 'Review', entityId: review.id } });
      return review;
    });
  }
}
