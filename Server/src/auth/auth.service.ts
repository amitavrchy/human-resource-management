import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto, RegisterDto, PasswordDto } from '../common/dto.js';
import type { Actor } from '../common/context.js';

export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const dummyHash =
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxYj3.Oi1hF0h4WQ6ZtFhpVZyZa';
export async function passwordHash(password: string) {
  if (Buffer.byteLength(password, 'utf8') > 72)
    throw new BadRequestException(
      'Password must be no more than 72 UTF-8 bytes.',
    );
  return hash(password, 12);
}
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, res: Response) {
    const secret = await passwordHash(dto.password);
    const result = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, name: dto.name, passwordHash: secret },
      });
      const org = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug: dto.slug,
          employeeSequence: 1,
        },
      });
      const member = await tx.membership.create({
        data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
      });
      const [firstName, ...rest] = dto.name.split(' ');
      await tx.employee.create({
        data: {
          organizationId: org.id,
          membershipId: member.id,
          employeeNumber: 'EMP-0001',
          firstName,
          lastName: rest.join(' ') || firstName,
          workEmail: dto.email,
          title: 'Founder',
          status: 'ACTIVE',
          startDate: new Date(),
        },
      });
      await tx.leavePolicy.createMany({
        data: [
          {
            organizationId: org.id,
            name: 'Annual leave',
            code: 'ANNUAL',
            annualDays: 20,
          },
          {
            organizationId: org.id,
            name: 'Sick leave',
            code: 'SICK',
            annualDays: 10,
          },
        ],
      });
      await tx.onboardingTemplate.create({
        data: {
          organizationId: org.id,
          name: 'Welcome aboard',
          isDefault: true,
          tasksJson: [
            { title: 'Set up your work account', sortOrder: 0 },
            { title: 'Collect your laptop', sortOrder: 1 },
            { title: 'Read the employee handbook', sortOrder: 2 },
            { title: 'Complete your payroll details', sortOrder: 3 },
          ],
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          actorUserId: user.id,
          action: 'organization.created',
          entityType: 'Organization',
          entityId: org.id,
        },
      });
      return { userId: user.id, organizationId: org.id };
    });
    return this.createSession(result.userId, result.organizationId, res);
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          where: dto.organizationSlug
            ? { organization: { slug: dto.organizationSlug } }
            : {},
          orderBy: { id: 'asc' },
          take: 1,
        },
      },
    });
    const valid = await compare(dto.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid || !user.memberships.length)
      throw new UnauthorizedException(
        'Email, password or workspace is incorrect.',
      );
    return this.createSession(user.id, user.memberships[0].organizationId, res);
  }

  private async createSession(
    userId: string,
    organizationId: string,
    res: Response,
  ) {
    const token = randomBytes(48).toString('base64url');
    const session = await this.db.refreshSession.create({
      data: {
        userId,
        organizationId,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    await this.setCookies(userId, organizationId, session.id, token, res);
    return { success: true };
  }

  async refresh(token: string | undefined, res: Response) {
    if (!token) throw new UnauthorizedException('Please sign in again.');
    const session = await this.db.refreshSession.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedException('Your session has expired.');
    const next = randomBytes(48).toString('base64url');
    // Compare-and-swap makes replayed and concurrent refresh tokens unusable.
    const result = await this.db.refreshSession.updateMany({
      where: {
        id: session.id,
        tokenHash: tokenHash(token),
        expiresAt: { gt: new Date() },
      },
      data: {
        tokenHash: tokenHash(next),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    if (!result.count)
      throw new UnauthorizedException(
        'Session already refreshed. Please sign in again.',
      );
    await this.setCookies(
      session.userId,
      session.organizationId,
      session.id,
      next,
      res,
    );
    return { success: true };
  }

  async logout(token: string | undefined, res: Response) {
    if (token)
      await this.db.refreshSession.deleteMany({
        where: { tokenHash: tokenHash(token) },
      });
    res.clearCookie('peopleos_access', this.cookieOptions());
    res.clearCookie('peopleos_refresh', this.cookieOptions());
    return { success: true };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }
  private async setCookies(
    userId: string,
    organizationId: string,
    sessionId: string,
    refresh: string,
    res: Response,
  ) {
    const access = await this.jwt.signAsync(
      { sub: userId, org: organizationId, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
        issuer: 'peopleos',
        audience: 'peopleos-web',
      },
    );
    res.cookie('peopleos_access', access, {
      ...this.cookieOptions(),
      maxAge: 15 * 60000,
    });
    res.cookie('peopleos_refresh', refresh, {
      ...this.cookieOptions(),
      maxAge: 7 * 86400000,
    });
  }

  async me(actor: Actor) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { id: true, email: true, name: true },
    });
    const organization = await this.db.organization.findUniqueOrThrow({
      where: { id: actor.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        workWeekdays: true,
      },
    });
    return {
      user,
      organization,
      role: actor.role,
      employeeId: actor.employeeId,
      membershipId: actor.membershipId,
    };
  }
  async changePassword(actor: Actor, dto: PasswordDto, res: Response) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    if (!(await compare(dto.currentPassword, user.passwordHash)))
      throw new UnauthorizedException('Your current password is incorrect.');
    const nextHash = await passwordHash(dto.newPassword);
    await this.db.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: actor.userId, passwordHash: user.passwordHash },
        data: { passwordHash: nextHash },
      });
      if (!result.count)
        throw new UnauthorizedException(
          'Password changed during this request. Please sign in again.',
        );
      await tx.refreshSession.deleteMany({ where: { userId: actor.userId } });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'account.password_changed',
          entityType: 'User',
          entityId: actor.userId,
        },
      });
    });
    res.clearCookie('peopleos_access', this.cookieOptions());
    res.clearCookie('peopleos_refresh', this.cookieOptions());
    return { success: true };
  }
}
