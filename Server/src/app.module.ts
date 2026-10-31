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

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: (env: Record<string, unknown>) => {
    const secret = env.JWT_SECRET;
    if (typeof secret !== 'string' || secret.length < 32 || /replace|change-me/i.test(secret)) throw new Error('JWT_SECRET must contain at least 32 random characters.');
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    return env;
  } }), JwtModule.register({}), PrismaModule],
  controllers: [AppController, AuthController],
  providers: [AppService, AuthService, AccessService, { provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}

