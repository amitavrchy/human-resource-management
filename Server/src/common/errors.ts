import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message: unknown = 'Something went wrong. Please try again.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { status = 409; message = 'A record with these details already exists.'; }
      if (error.code === 'P2025') { status = 404; message = 'Record not found.'; }
      if (error.code === 'P2003') { status = 409; message = 'This record is still in use.'; }
    }
    if (status === 500) this.logger.error(error instanceof Error ? `${error.name}: ${error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'unhandled failure'}` : 'Unhandled failure');
    response.status(status).json({ statusCode: status, message });
  }
}
