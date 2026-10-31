import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from './auth.guard.js';
import { LoginDto, RegisterDto, PasswordDto } from '../common/dto.js';
import { CurrentActor, type Actor } from '../common/context.js';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('auth/register') register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) { return this.auth.register(dto, res); }
  @Public() @Post('auth/login') login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { return this.auth.login(dto, res); }
  @Public() @Post('auth/refresh') refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.refresh((req.cookies as Record<string, string>)?.peopleos_refresh, res); }
  @Public() @Post('auth/logout') logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout((req.cookies as Record<string, string>)?.peopleos_refresh, res); }
  @Get('me') me(@CurrentActor() actor: Actor) { return this.auth.me(actor); }
  @Post('auth/change-password') changePassword(@CurrentActor() actor: Actor, @Body() dto: PasswordDto, @Res({ passthrough: true }) res: Response) { return this.auth.changePassword(actor, dto, res); }
}
