import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { json, urlencoded } from 'express';
import { ApiExceptionFilter } from './common/errors.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication) {
  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: '512kb' }));
  app.use(urlencoded({ extended: false, limit: '512kb' }));
  const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000').split(',').map(origin => origin.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutation && (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && !origins.includes(req.headers.origin)))) { res.status(403).json({ message: 'Request origin is not allowed.' }); return; }
    next();
  });
  // A bounded per-process limiter. Use an edge/shared limiter when scaling replicas.
  const attempts = new Map<string, { count: number; until: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (attempts.size > 10000) for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const auth = req.path.startsWith('/auth/') && req.method === 'POST';
    const key = `${req.ip}:${auth ? 'auth' : 'api'}`;
    let state = attempts.get(key);
    if (!state || state.until <= now) { state = { count: 0, until: now + 60000 }; attempts.set(key, state); }
    if (++state.count > (auth ? 30 : 600)) { res.setHeader('Retry-After', Math.ceil((state.until - now) / 1000)); res.status(429).json({ message: 'Too many requests. Try again shortly.' }); return; }
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, forbidUnknownValues: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('PeopleOS API').setVersion('1.0').addCookieAuth('peopleos_access').build());
    SwaggerModule.setup('docs', app, document);
  }
}
