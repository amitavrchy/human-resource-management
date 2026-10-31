import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { SessionGuard } from './auth/auth.guard.js';
import { AccessService } from './common/access.service.js';
import { PeopleService } from './people/people.service.js';
import { PeopleController } from './people/people.controller.js';
import { OrganizationService } from './organization/organization.service.js';
import { OrganizationController } from './organization/organization.controller.js';
import { LeaveService } from './leave/leave.service.js';
import { LeaveController } from './leave/leave.controller.js';
import { RecruitingController } from './recruiting/recruiting.controller.js';
import { RecruitingService } from './recruiting/recruiting.service.js';
import { FilesService } from './common/files.service.js';
import { LifecycleController } from './lifecycle/lifecycle.controller.js';
import { LifecycleService } from './lifecycle/lifecycle.service.js';
import { DocumentsController } from './documents/documents.controller.js';
import { DocumentsService } from './documents/documents.service.js';
import { AiController } from './ai/ai.controller.js';
import { AiService } from './ai/ai.service.js';
import { ReportsController } from './reports/reports.controller.js';
import { ReportsService } from './reports/reports.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: (env: Record<string, unknown>) => {
    const secret = env.JWT_SECRET;
    if (typeof secret !== 'string' || secret.length < 32 || /replace|change-me/i.test(secret)) throw new Error('JWT_SECRET must contain at least 32 random characters.');
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    return env;
  } }), JwtModule.register({}), PrismaModule],
  controllers: [AppController, AuthController, PeopleController, OrganizationController, LeaveController, RecruitingController, LifecycleController, DocumentsController, AiController, ReportsController],
  providers: [AppService, AuthService, AccessService, PeopleService, OrganizationService, LeaveService, RecruitingService, FilesService, LifecycleService, DocumentsService, AiService, ReportsService, { provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}

