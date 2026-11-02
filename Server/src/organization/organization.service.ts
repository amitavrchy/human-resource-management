import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../common/access.service.js';
import { type Actor, requireAdmin, requireRole } from '../common/context.js';
import {
  LocationDto,
  MemberDto,
  NameDto,
  OrganizationDto,
  PolicyDto,
  RoleDto,
  TemplateDto,
} from '../common/dto.js';
import { passwordHash } from '../auth/auth.service.js';
import { serializable } from '../common/database.js';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
  ) {}
  async metadata(actor: Actor) {
    const where = { organizationId: actor.organizationId };
    const [departments, locations, policies, templates] = await Promise.all([
      this.db.department.findMany({ where, orderBy: { name: 'asc' } }),
      this.db.location.findMany({ where, orderBy: { name: 'asc' } }),
      this.db.leavePolicy.findMany({ where, orderBy: { name: 'asc' } }),
      this.db.onboardingTemplate.findMany({ where, orderBy: { id: 'asc' } }),
    ]);
    return { departments, locations, policies, templates };
  }
  async organization(actor: Actor, dto: OrganizationDto) {
    requireAdmin(actor);
    try {
      new Intl.DateTimeFormat('en', { timeZone: dto.timezone });
    } catch {
      throw new BadRequestException('Choose a valid IANA time zone.');
    }
    return this.db.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: actor.organizationId },
        data: dto,
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'organization.updated',
          entityType: 'Organization',
          entityId: actor.organizationId,
        },
      });
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        timezone: org.timezone,
      };
    });
  }
  async save(
    actor: Actor,
    kind: 'department' | 'location' | 'policy' | 'template',
    dto: NameDto | LocationDto | PolicyDto | TemplateDto,
    id?: string,
  ) {
    requireAdmin(actor);
    return serializable(this.db, async (tx) => {
      const organizationId = actor.organizationId;
      let record: { id: string };
      if (kind === 'department')
        record = id
          ? await tx.department.update({
              where: { id, organizationId },
              data: { name: dto.name },
            })
          : await tx.department.create({
              data: { name: dto.name, organizationId },
            });
      else if (kind === 'location')
        record = id
          ? await tx.location.update({
              where: { id, organizationId },
              data: dto as LocationDto,
            })
          : await tx.location.create({
              data: { ...(dto as LocationDto), organizationId },
            });
      else if (kind === 'policy') {
        const policy = dto as PolicyDto;
        record = id
          ? await tx.leavePolicy.update({
              where: { id, organizationId },
              data: policy,
            })
          : await tx.leavePolicy.create({
              data: { ...policy, organizationId },
            });
        // Entitlement changes apply to newly initialized balances; never overwrite consumed balances.
      } else {
        const template = dto as TemplateDto;
        const data = {
          name: dto.name,
          tasksJson: template.tasks.map((task, sortOrder) => ({
            title: task.title,
            sortOrder,
          })),
        };
        record = id
          ? await tx.onboardingTemplate.update({
              where: { id, organizationId },
              data,
            })
          : await tx.onboardingTemplate.create({
              data: { ...data, organizationId },
            });
      }
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor.userId,
          action: `${kind}.${id ? 'updated' : 'created'}`,
          entityType: kind,
          entityId: record.id,
        },
      });
      return record;
    });
  }
  async remove(
    actor: Actor,
    kind: 'department' | 'location' | 'policy' | 'template',
    id: string,
  ) {
    requireAdmin(actor);
    return serializable(this.db, async (tx) => {
      const where = { id, organizationId: actor.organizationId };
      if (kind === 'department') await tx.department.delete({ where });
      if (kind === 'location') await tx.location.delete({ where });
      if (kind === 'policy') {
        if (
          await tx.leaveRequest.count({
            where: { organizationId: actor.organizationId, policyId: id },
          })
        )
          throw new ConflictException(
            'Policies with leave history cannot be deleted.',
          );
        await tx.leavePolicy.delete({ where });
      }
      if (kind === 'template') {
        const removed = await tx.onboardingTemplate.delete({ where });
        if (removed.isDefault) {
          const next = await tx.onboardingTemplate.findFirst({
            where: { organizationId: actor.organizationId },
            orderBy: { id: 'asc' },
          });
          if (next)
            await tx.onboardingTemplate.update({
              where: { id: next.id, organizationId: actor.organizationId },
              data: { isDefault: true },
            });
        }
      }
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: `${kind}.deleted`,
          entityType: kind,
          entityId: id,
        },
      });
      return { success: true };
    });
  }
  members(actor: Actor) {
    requireAdmin(actor);
    return this.db.membership.findMany({
      where: { organizationId: actor.organizationId },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { id: 'asc' },
    });
  }
  async defaultTemplate(actor: Actor, id: string) {
    requireAdmin(actor);
    return serializable(this.db, async (tx) => {
      await tx.onboardingTemplate.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId },
      });
      await tx.onboardingTemplate.updateMany({
        where: { organizationId: actor.organizationId, isDefault: true },
        data: { isDefault: false },
      });
      const template = await tx.onboardingTemplate.update({
        where: { id, organizationId: actor.organizationId },
        data: { isDefault: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'template.default_changed',
          entityType: 'OnboardingTemplate',
          entityId: id,
        },
      });
      return template;
    });
  }
  async createMember(actor: Actor, dto: MemberDto) {
    requireAdmin(actor);
    if (dto.role === 'OWNER') requireRole(actor, 'OWNER');
    const secret = await passwordHash(dto.password);
    return serializable(this.db, async (tx) => {
      if (dto.employeeId) {
        await this.access.reference(tx, actor, 'employee', dto.employeeId);
        const employee = await tx.employee.findFirstOrThrow({
          where: { id: dto.employeeId, organizationId: actor.organizationId },
        });
        if (
          employee.membershipId ||
          employee.workEmail.toLowerCase() !== dto.email
        )
          throw new ConflictException(
            'Use an unlinked employee with the same work email.',
          );
      }
      const user = await tx.user.create({
        data: { name: dto.name, email: dto.email, passwordHash: secret },
      });
      const member = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: actor.organizationId,
          role: dto.role,
        },
      });
      if (dto.employeeId)
        await tx.employee.update({
          where: { id: dto.employeeId, organizationId: actor.organizationId },
          data: { membershipId: member.id },
        });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'member.created',
          entityType: 'Membership',
          entityId: member.id,
        },
      });
      return {
        id: member.id,
        role: member.role,
        user: { id: user.id, name: user.name, email: user.email },
      };
    });
  }
  async changeRole(actor: Actor, id: string, dto: RoleDto) {
    requireAdmin(actor);
    return serializable(this.db, async (tx) => {
      const member = await tx.membership.findFirst({
        where: { id, organizationId: actor.organizationId },
      });
      if (!member) throw new NotFoundException('Member not found.');
      if (member.role === 'OWNER' || dto.role === 'OWNER')
        requireRole(actor, 'OWNER');
      if (
        member.role === 'OWNER' &&
        dto.role !== 'OWNER' &&
        (await tx.membership.count({
          where: { organizationId: actor.organizationId, role: 'OWNER' },
        })) <= 1
      )
        throw new ConflictException(
          'Your workspace must retain at least one owner.',
        );
      await tx.membership.update({
        where: { id, organizationId: actor.organizationId },
        data: { role: dto.role },
      });
      await tx.refreshSession.deleteMany({
        where: { organizationId: actor.organizationId, userId: member.userId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'member.role_changed',
          entityType: 'Membership',
          entityId: id,
          metaJson: { from: member.role, to: dto.role },
        },
      });
      return { success: true };
    });
  }
}
