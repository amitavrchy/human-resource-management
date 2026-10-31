import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Employee } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../common/access.service.js';
import { type Actor, isAdmin, requireAdmin } from '../common/context.js';
import { EmployeeDto, PageDto, UpdateEmployeeDto } from '../common/dto.js';
import { dateOnly, serializable } from '../common/database.js';

export const employeeSelect = {
  id: true, employeeNumber: true, firstName: true, lastName: true, workEmail: true, title: true, departmentId: true, locationId: true, managerId: true, status: true, startDate: true, endDate: true, avatarUrl: true,
  department: { select: { id: true, name: true } }, location: { select: { id: true, name: true, country: true } }, manager: { select: { id: true, firstName: true, lastName: true, title: true } },
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class PeopleService {
  constructor(private readonly db: PrismaService, private readonly access: AccessService) {}
  async list(actor: Actor, query: PageDto) {
    const where: Prisma.EmployeeWhereInput = {
      ...(await this.access.employeeWhere(actor)),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { OR: ['firstName', 'lastName', 'workEmail', 'title'].map(field => ({ [field]: { contains: query.q, mode: 'insensitive' } })) } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.employee.findMany({ where, select: employeeSelect, orderBy: [{ firstName: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
      this.db.employee.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) };
  }
  async tree(actor: Actor) {
    return this.db.employee.findMany({ where: { ...(await this.access.employeeWhere(actor)), status: { not: 'TERMINATED' } }, select: employeeSelect, orderBy: { firstName: 'asc' } });
  }
  async detail(actor: Actor, id: string) {
    const employee = await this.access.employee(actor, id);
    const privateAccess = isAdmin(actor) || actor.employeeId === id;
    const profile = await this.db.employee.findFirstOrThrow({ where: { id, organizationId: actor.organizationId }, select: { ...employeeSelect, ...(privateAccess ? { personalEmail: true, phone: true, birthDate: true, emergencyName: true, emergencyPhone: true, customFields: true } : {}) } });
    const [tasks, leaveHistory, documents] = await Promise.all([
      this.db.onboardingTask.findMany({ where: { organizationId: actor.organizationId, employeeId: employee.id }, orderBy: { sortOrder: 'asc' } }),
      this.db.leaveRequest.findMany({ where: { organizationId: actor.organizationId, employeeId: id }, include: { policy: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
      privateAccess ? this.db.document.findMany({ where: { organizationId: actor.organizationId, employeeId: id }, select: { id: true, title: true, category: true, size: true, createdAt: true } }) : [],
    ]);
    return { ...profile, tasks, leaveHistory: leaveHistory.map(({ reason, ...request }) => ({ ...request, ...(privateAccess ? { reason } : {}) })), documents, privateAccess };
  }

  async create(actor: Actor, dto: EmployeeDto) {
    requireAdmin(actor);
    return serializable(this.db, async tx => {
      await this.validateReferences(tx, actor, dto);
      return this.createInTransaction(tx, actor, dto);
    });
  }
  async createInTransaction(tx: Prisma.TransactionClient, actor: Actor, dto: EmployeeDto) {
    const org = await tx.organization.update({ where: { id: actor.organizationId }, data: { employeeSequence: { increment: 1 } } });
    const employee = await tx.employee.create({ data: { ...this.employeeData(dto), firstName: dto.firstName, lastName: dto.lastName, workEmail: dto.workEmail, organizationId: actor.organizationId, employeeNumber: `EMP-${String(org.employeeSequence).padStart(4, '0')}` } });
    const template = await tx.onboardingTemplate.findFirst({ where: { organizationId: actor.organizationId }, orderBy: { id: 'asc' } });
    const tasks = (template?.tasksJson ?? [{ title: 'Set up your work account' }, { title: 'Collect your laptop' }, { title: 'Read the employee handbook' }, { title: 'Complete your payroll details' }]) as { title: string }[];
    await tx.onboardingTask.createMany({ data: tasks.map((task, sortOrder) => ({ organizationId: actor.organizationId, employeeId: employee.id, title: task.title, sortOrder })) });
    const policies = await tx.leavePolicy.findMany({ where: { organizationId: actor.organizationId } });
    await tx.leaveBalance.createMany({ data: policies.map(policy => ({ organizationId: actor.organizationId, employeeId: employee.id, policyId: policy.id, year: new Date().getUTCFullYear(), balanceDays: policy.annualDays })) });
    await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'employee.created', entityType: 'Employee', entityId: employee.id } });
    return employee;
  }
  async update(actor: Actor, id: string, dto: UpdateEmployeeDto) {
    await this.access.employee(actor, id);
    if (!isAdmin(actor)) {
      if (actor.employeeId !== id || Object.keys(dto).some(key => !['personalEmail', 'phone', 'emergencyName', 'emergencyPhone'].includes(key))) throw new BadRequestException('You may only update your own contact and emergency details.');
    }
    return serializable(this.db, async tx => {
      await this.validateReferences(tx, actor, dto, id);
      const employee = await tx.employee.update({ where: { id, organizationId: actor.organizationId }, data: this.employeeData(dto) });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'employee.updated', entityType: 'Employee', entityId: id, metaJson: { fields: Object.keys(dto) } } });
      return this.safeEmployee(employee, actor);
    });
  }
  async archive(actor: Actor, id: string) {
    requireAdmin(actor);
    if (id === actor.employeeId) throw new ConflictException('You cannot archive your own employee record.');
    const employee = await this.access.employee(actor, id);
    if (employee.membershipId) {
      const member = await this.db.membership.findUnique({ where: { id: employee.membershipId } });
      if (member?.role === 'OWNER') throw new ConflictException('Transfer the owner role before archiving this employee.');
    }
    return this.update(actor, id, { status: 'TERMINATED', endDate: new Date().toISOString().slice(0, 10) });
  }
  safeEmployee(employee: Employee, actor: Actor) {
    if (isAdmin(actor) || employee.id === actor.employeeId) return employee;
    const { personalEmail: _personal, emergencyName: _name, emergencyPhone: _phone, birthDate: _birth, customFields: _custom, ...safe } = employee;
    return safe;
  }
  employeeData(dto: UpdateEmployeeDto) {
    const { startDate, endDate, birthDate, departmentId, locationId, managerId, ...rest } = dto;
    return { ...rest, ...(startDate !== undefined ? { startDate: startDate ? dateOnly(startDate) : null } : {}), ...(endDate !== undefined ? { endDate: endDate ? dateOnly(endDate) : null } : {}), ...(birthDate !== undefined ? { birthDate: birthDate ? dateOnly(birthDate) : null } : {}), ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}), ...(locationId !== undefined ? { locationId: locationId || null } : {}), ...(managerId !== undefined ? { managerId: managerId || null } : {}) };
  }
  async validateReferences(tx: Prisma.TransactionClient, actor: Actor, dto: UpdateEmployeeDto, id?: string) {
    await this.access.reference(tx, actor, 'department', dto.departmentId);
    await this.access.reference(tx, actor, 'location', dto.locationId);
    await this.access.reference(tx, actor, 'employee', dto.managerId);
    if (dto.startDate && dto.endDate && dateOnly(dto.endDate) < dateOnly(dto.startDate)) throw new BadRequestException('End date must follow start date.');
    if (dto.birthDate && dateOnly(dto.birthDate) > new Date()) throw new BadRequestException('Birth date must be in the past.');
    if (!dto.managerId || !id) return;
    const visited = new Set<string>([id]);
    let managerId: string | null = dto.managerId;
    while (managerId) {
      if (visited.has(managerId)) throw new ConflictException('This manager would create a reporting cycle.');
      visited.add(managerId);
      const manager: { managerId: string | null } | null = await tx.employee.findFirst({ where: { id: managerId, organizationId: actor.organizationId }, select: { managerId: true } });
      if (!manager) throw new NotFoundException('Manager not found.');
      managerId = manager.managerId;
    }
  }
}
