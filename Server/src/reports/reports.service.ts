import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../common/access.service.js';
import { type Actor, isAdmin, requireAdmin, requireRecruiting } from '../common/context.js';
import { PageDto } from '../common/dto.js';

@Injectable()
export class ReportsService {
  constructor(private readonly db: PrismaService, private readonly access: AccessService) {}
  async dashboard(actor: Actor) {
    const scope = await this.access.employeeWhere(actor);
    const ids = await this.access.employeeIds(actor);
    const organizationId = actor.organizationId;
    const leaveWhere = { organizationId, ...(ids ? { employeeId: { in: ids } } : {}) };
    const jobWhere = { organizationId, ...(actor.role === 'MANAGER' ? { hiringManagerId: actor.employeeId ?? '__none__' } : {}) };
    const recruiting = ['OWNER', 'HR_ADMIN', 'MANAGER', 'RECRUITER'].includes(actor.role);
    const [employees, pendingLeave, openJobs, tasks, activity, upcomingLeave] = await Promise.all([
      this.db.employee.findMany({ where: scope, select: { id: true, firstName: true, lastName: true, title: true, status: true, birthDate: true, startDate: true, endDate: true, createdAt: true, department: { select: { name: true } } } }),
      this.db.leaveRequest.count({ where: { ...leaveWhere, status: 'PENDING', ...(actor.role === 'MANAGER' ? { employeeId: { in: (ids ?? []).filter(id => id !== actor.employeeId) } } : {}) } }),
      recruiting ? this.db.job.count({ where: { ...jobWhere, status: 'OPEN' } }) : 0,
      this.db.onboardingTask.findMany({ where: { organizationId, ...(ids ? { employeeId: { in: ids } } : {}), status: { not: 'DONE' }, employee: { status: { not: 'TERMINATED' } } }, include: { employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }], take: 6 }),
      this.db.auditLog.findMany({ where: { organizationId, ...(!isAdmin(actor) ? { actorUserId: actor.userId } : {}) }, select: { id: true, action: true, entityType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.db.leaveRequest.findMany({ where: { ...leaveWhere, status: 'APPROVED', endDate: { gte: new Date() } }, include: { employee: { select: { firstName: true, lastName: true } }, policy: { select: { name: true } } }, orderBy: { startDate: 'asc' }, take: 5 }),
    ]);
    const today = new Date();
    const celebrations: { id: string; name: string; title: string | null; type: string; date: string }[] = [];
    for (const employee of employees.filter(employee => employee.status !== 'TERMINATED')) {
      for (const [type, date] of [['birthday', employee.birthDate], ['anniversary', employee.startDate]] as const) {
        if (!date) continue;
        const next = new Date(Date.UTC(today.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        if (next < new Date(today.toISOString().slice(0, 10))) next.setUTCFullYear(next.getUTCFullYear() + 1);
        if ((next.getTime() - today.getTime()) / 86400000 <= 7) celebrations.push({ id: employee.id + type, name: `${employee.firstName} ${employee.lastName}`, title: employee.title, type, date: next.toISOString() });
      }
    }
    const trend = Array.from({ length: 6 }, (_, i) => {
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 4 + i, 0, 23, 59, 59));
      return { month: end.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), count: employees.filter(e => (e.startDate ?? e.createdAt) <= end && (!e.endDate || e.endDate > end)).length };
    });
    const active = employees.filter(e => e.status !== 'TERMINATED');
    const departments = Object.entries(active.reduce<Record<string, number>>((counts, e) => { const name = e.department?.name ?? 'Unassigned'; counts[name] = (counts[name] ?? 0) + 1; return counts; }, {})).map(([name, count]) => ({ name, count }));
    return { headcount: active.length, onboarding: active.filter(e => e.status === 'ONBOARDING').length, pendingLeave, openJobs, tasks, activity, upcomingLeave, celebrations, trend, departments, scope: isAdmin(actor) ? 'Workspace' : actor.role === 'MANAGER' ? 'Your team' : 'Your workspace activity' };
  }
  async headcount(actor: Actor) {
    requireAdmin(actor);
    const [employees, departments, locations] = await Promise.all([
      this.db.employee.findMany({ where: { organizationId: actor.organizationId }, select: { departmentId: true, locationId: true, status: true, startDate: true, endDate: true, createdAt: true } }),
      this.db.department.findMany({ where: { organizationId: actor.organizationId } }),
      this.db.location.findMany({ where: { organizationId: actor.organizationId } }),
    ]);
    const active = employees.filter(e => e.status !== 'TERMINATED');
    const today = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11 + i, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      return { month: start.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }), headcount: employees.filter(e => (e.startDate ?? e.createdAt) < end && (!e.endDate || e.endDate >= end)).length, joiners: employees.filter(e => (e.startDate ?? e.createdAt) >= start && (e.startDate ?? e.createdAt) < end).length, leavers: employees.filter(e => e.endDate && e.endDate >= start && e.endDate < end).length };
    });
    return { total: active.length, departments: [...departments.map(d => ({ name: d.name, count: active.filter(e => e.departmentId === d.id).length })), { name: 'Unassigned', count: active.filter(e => !e.departmentId).length }].filter(d => d.count), locations: [...locations.map(l => ({ name: l.name, count: active.filter(e => e.locationId === l.id).length })), { name: 'Unassigned', count: active.filter(e => !e.locationId).length }].filter(l => l.count), months };
  }
  async funnel(actor: Actor) {
    requireRecruiting(actor);
    const jobs = await this.db.job.findMany({ where: { organizationId: actor.organizationId, ...(actor.role === 'MANAGER' ? { hiringManagerId: actor.employeeId ?? '__none__' } : {}) }, include: { candidates: { select: { stage: true } } }, take: 200 });
    const stages = ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
    return { stages: stages.map(stage => ({ stage, count: jobs.reduce((total, job) => total + job.candidates.filter(candidate => candidate.stage === stage).length, 0) })), jobs: jobs.map(job => ({ id: job.id, title: job.title, total: job.candidates.length, hired: job.candidates.filter(c => c.stage === 'HIRED').length, conversion: job.candidates.length ? Math.round(job.candidates.filter(c => c.stage === 'HIRED').length / job.candidates.length * 100) : 0 })) };
  }
  async leave(actor: Actor) {
    requireAdmin(actor);
    const year = new Date().getUTCFullYear();
    const [policies, requests, employees] = await Promise.all([
      this.db.leavePolicy.findMany({ where: { organizationId: actor.organizationId }, include: { balances: { where: { year } } } }),
      this.db.leaveRequest.findMany({ where: { organizationId: actor.organizationId, startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, select: { status: true, policyId: true, days: true } }),
      this.db.employee.count({ where: { organizationId: actor.organizationId, status: { not: 'TERMINATED' } } }),
    ]);
    return { year, policies: policies.map(policy => { const used = requests.filter(r => r.policyId === policy.id && r.status === 'APPROVED').reduce((sum, r) => sum + r.days, 0); const allocated = used + policy.balances.reduce((sum, balance) => sum + balance.balanceDays, 0) + Math.max(0, employees - policy.balances.length) * policy.annualDays; return { name: policy.name, used, allocated, utilization: allocated ? Math.round(used / allocated * 100) : 0, pending: requests.filter(r => r.policyId === policy.id && r.status === 'PENDING').reduce((sum, r) => sum + r.days, 0) }; }) };
  }
  async audit(actor: Actor, query: PageDto) {
    requireAdmin(actor);
    const where = { organizationId: actor.organizationId, ...(query.q ? { action: { contains: query.q, mode: 'insensitive' as const } } : {}) };
    const [items, total] = await this.db.$transaction([this.db.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit, skip: (query.page - 1) * query.limit }), this.db.auditLog.count({ where })]);
    return { items, total, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) };
  }
}
