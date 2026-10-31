import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthRequest } from '../common/context.js';

export const Public = () => SetMetadata('public', true);
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly config: ConfigService, private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.peopleos_access;
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    let payload: { sub: string; org: string; sid: string };
    try { payload = await this.jwt.verifyAsync(token, { secret: this.config.getOrThrow<string>('JWT_SECRET'), issuer: 'peopleos', audience: 'peopleos-web', algorithms: ['HS256'] }); }
    catch { throw new UnauthorizedException('Your session has expired.'); }
    if (!payload.sub || !payload.org || !payload.sid) throw new UnauthorizedException();
    const [member, session] = await Promise.all([
      this.db.membership.findUnique({ where: { organizationId_userId: { organizationId: payload.org, userId: payload.sub } }, include: { employee: { select: { id: true, status: true } } } }),
      this.db.refreshSession.findFirst({ where: { id: payload.sid, userId: payload.sub, organizationId: payload.org, expiresAt: { gt: new Date() } }, select: { id: true } }),
    ]);
    if (!member || !session || member.employee?.status === 'TERMINATED') throw new UnauthorizedException('Your access has ended.');
    req.actor = { userId: payload.sub, organizationId: payload.org, sessionId: payload.sid, role: member.role, membershipId: member.id, employeeId: member.employee?.id ?? null };
    return true;
  }
}
