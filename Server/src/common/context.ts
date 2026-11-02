import {
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { OrgRole } from '@prisma/client';
import type { Request } from 'express';

export interface Actor {
  userId: string;
  organizationId: string;
  membershipId: string;
  employeeId: string | null;
  role: OrgRole;
  sessionId: string;
}
export type AuthRequest = Request & { actor: Actor };
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthRequest>().actor,
);
export const isAdmin = (actor: Actor) =>
  actor.role === 'OWNER' || actor.role === 'HR_ADMIN';
export function requireRole(actor: Actor, ...roles: OrgRole[]) {
  if (!roles.includes(actor.role))
    throw new ForbiddenException(
      'Your role does not have access to this action.',
    );
}
export function requireAdmin(actor: Actor) {
  requireRole(actor, 'OWNER', 'HR_ADMIN');
}
export function requireRecruiting(actor: Actor, write = false) {
  requireRole(
    actor,
    'OWNER',
    'HR_ADMIN',
    'RECRUITER',
    ...(write ? [] : ['MANAGER' as const]),
  );
}
