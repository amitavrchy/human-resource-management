import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../common/access.service.js';
import { type Actor, isAdmin, requireRole } from '../common/context.js';
import { LeaveDto } from '../common/dto.js';
import { dateOnly, serializable, workingDays } from '../common/database.js';

const include = { employee: { select: { id: true, firstName: true, lastName: true, title: true, department: { select: { name: true } } } }, policy: true } satisfies Prisma.LeaveRequestInclude;
@Injectable()
export class LeaveService {
  constructor(private readonly db: PrismaService, private readonly access: AccessService) {}
  async list(actor: Actor) {
    const ids = await this.access.employeeIds(actor);
    return this.db.leaveRequest.findMany({ where: { organizationId: actor.organizationId, ...(ids ? { employeeId: { in: ids } } : {}) }, include, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 500 });
  }
  private async balance(tx: Prisma.TransactionClient, organizationId: string, employeeId: string, policyId: string, year: number) {
    const policy = await tx.leavePolicy.findFirst({ where: { id: policyId, organizationId } });
    if (!policy) throw new NotFoundException('Leave policy not found.');
    return tx.leaveBalance.upsert({ where: { employeeId_policyId_year: { employeeId, policyId, year } }, update: {}, create: { organizationId, employeeId, policyId, year, balanceDays: policy.annualDays } });
  }
  async balances(actor: Actor, employeeId = actor.employeeId ?? '', year = new Date().getUTCFullYear()) {
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new BadRequestException('Invalid balance year.');
    if (!employeeId) return [];
    await this.access.employee(actor, employeeId);
    return serializable(this.db, async tx => {
      const policies = await tx.leavePolicy.findMany({ where: { organizationId: actor.organizationId }, orderBy: { name: 'asc' } });
      const result: { id: string; policyId: string; policy: typeof policies[number]; year: number; balanceDays: number; pendingDays: number }[] = [];
      for (const policy of policies) {
        const balance = await this.balance(tx, actor.organizationId, employeeId, policy.id, year);
        const pending = await tx.leaveRequest.aggregate({ where: { organizationId: actor.organizationId, employeeId, policyId: policy.id, status: 'PENDING', startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, _sum: { days: true } });
        result.push({ ...balance, policy, pendingDays: pending._sum.days ?? 0 });
      }
      return result;
    });
  }
  async create(actor: Actor, dto: LeaveDto) {
    const employee = await this.access.employee(actor, dto.employeeId);
    if (!isAdmin(actor) && dto.employeeId !== actor.employeeId) throw new ForbiddenException('You can only request your own time off.');
    if (employee.status === 'TERMINATED') throw new BadRequestException('Archived employees cannot request leave.');
    const startDate = dateOnly(dto.startDate), endDate = dateOnly(dto.endDate);
    const year = startDate.getUTCFullYear();
    const currentYear = new Date().getUTCFullYear();
    if (year < currentYear - 1 || year > currentYear + 1) throw new BadRequestException('Choose dates within the previous, current or next year.');
    return serializable(this.db, async tx => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: actor.organizationId } });
      const days = workingDays(startDate, endDate, org.workWeekdays);
      const overlap = await tx.leaveRequest.findFirst({ where: { organizationId: actor.organizationId, employeeId: dto.employeeId, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: endDate }, endDate: { gte: startDate } } });
      if (overlap) throw new ConflictException('These dates overlap an existing request.');
      const balance = await this.balance(tx, actor.organizationId, dto.employeeId, dto.policyId, year);
      const pending = await tx.leaveRequest.aggregate({ where: { organizationId: actor.organizationId, employeeId: dto.employeeId, policyId: dto.policyId, status: 'PENDING', startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, _sum: { days: true } });
      if (days > balance.balanceDays - (pending._sum.days ?? 0)) throw new ConflictException('Insufficient available balance after pending requests.');
      const request = await tx.leaveRequest.create({ data: { organizationId: actor.organizationId, employeeId: dto.employeeId, policyId: dto.policyId, reason: dto.reason, startDate, endDate, days }, include });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'leave.requested', entityType: 'LeaveRequest', entityId: request.id, metaJson: { days } } });
      return request;
    });
  }
  async decide(actor: Actor, id: string, decision: 'APPROVED' | 'REJECTED' | 'CANCELLED') {
    if (decision !== 'CANCELLED') requireRole(actor, 'OWNER', 'HR_ADMIN', 'MANAGER');
    const ids = await this.access.employeeIds(actor);
    return serializable(this.db, async tx => {
      const request = await tx.leaveRequest.findFirst({ where: { id, organizationId: actor.organizationId, ...(ids ? { employeeId: { in: ids } } : {}) } });
      if (!request) throw new NotFoundException('Leave request not found.');
      if (decision !== 'CANCELLED' && request.employeeId === actor.employeeId) throw new ForbiddenException('Another approver must review your own leave.');
      if (decision === 'CANCELLED') {
        if (!isAdmin(actor) && request.employeeId !== actor.employeeId) throw new ForbiddenException('You can only cancel your own request.');
        if (!['PENDING', 'APPROVED'].includes(request.status)) throw new ConflictException('This request cannot be cancelled.');
        if (request.status === 'APPROVED' && request.startDate <= new Date()) throw new ConflictException('Contact HR to amend leave that has already started.');
      } else if (request.status !== 'PENDING') throw new ConflictException('This request has already been reviewed.');
      const year = request.startDate.getUTCFullYear();
      if (decision === 'APPROVED') {
        await this.balance(tx, actor.organizationId, request.employeeId, request.policyId, year);
        const updated = await tx.leaveBalance.updateMany({ where: { organizationId: actor.organizationId, employeeId: request.employeeId, policyId: request.policyId, year, balanceDays: { gte: request.days } }, data: { balanceDays: { decrement: request.days } } });
        if (!updated.count) throw new ConflictException('This employee no longer has enough leave balance.');
      }
      if (decision === 'CANCELLED' && request.status === 'APPROVED') await tx.leaveBalance.update({ where: { employeeId_policyId_year: { employeeId: request.employeeId, policyId: request.policyId, year } }, data: { balanceDays: { increment: request.days } } });
      const result = await tx.leaveRequest.update({ where: { id, organizationId: actor.organizationId }, data: { status: decision, decidedById: actor.userId, decidedAt: new Date() }, include });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: `leave.${decision.toLowerCase()}`, entityType: 'LeaveRequest', entityId: id } });
      return result;
    });
  }
}
