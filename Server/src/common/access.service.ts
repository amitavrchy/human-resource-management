import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type Actor, isAdmin } from './context.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AccessService {
  constructor(private readonly db: PrismaService) {}
  async employeeIds(actor: Actor): Promise<string[] | null> {
    if (isAdmin(actor)) return null;
    if (!actor.employeeId) return [];
    if (actor.role !== 'MANAGER') return [actor.employeeId];
    const employees = await this.db.employee.findMany({ where: { organizationId: actor.organizationId }, select: { id: true, managerId: true } });
    const ids = new Set([actor.employeeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const employee of employees) if (employee.managerId && ids.has(employee.managerId) && !ids.has(employee.id)) { ids.add(employee.id); changed = true; }
    }
    return [...ids];
  }
  async employeeWhere(actor: Actor): Promise<Prisma.EmployeeWhereInput> {
    const ids = await this.employeeIds(actor);
    return { organizationId: actor.organizationId, ...(ids ? { id: { in: ids } } : {}) };
  }
  async employee(actor: Actor, id: string, privateFields = false) {
    const employee = await this.db.employee.findFirst({ where: { ...(await this.employeeWhere(actor)), id } });
    if (!employee) throw new NotFoundException('Employee not found.');
    if (privateFields && !isAdmin(actor) && id !== actor.employeeId) throw new ForbiddenException('Only the employee and HR may access private details.');
    return employee;
  }
  async reference(tx: Prisma.TransactionClient, actor: Actor, kind: 'department' | 'location' | 'employee', id?: string | null) {
    if (!id) return;
    const record = kind === 'department' ? await tx.department.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } }) : kind === 'location' ? await tx.location.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } }) : await tx.employee.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } });
    if (!record) throw new NotFoundException(`${kind} not found in this workspace.`);
  }
}
