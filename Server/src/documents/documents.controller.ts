import { BadRequestException, Body, Controller, Delete, Get, Param, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { CurrentActor, type Actor } from '../common/context.js';
import { DocumentDto } from '../common/dto.js';
import { DocumentsService } from './documents.service.js';
import { AiService } from '../ai/ai.service.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService, private readonly ai: AiService) {}
  @Get() list(@CurrentActor() a: Actor) { return this.documents.list(a); }
  @Post() async create(@CurrentActor() a: Actor, @Body() d: DocumentDto) {
    const document = await this.documents.create(a, d);
    if (document.isHandbook) {
      try { await this.ai.ingest(a, document.id); return { ...document, ingestStatus: 'READY' }; }
      catch { return { ...document, ingestStatus: 'FAILED' }; }
    }
    return document;
  }
  @Post('upload') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  async upload(@CurrentActor() a: Actor, @Body() body: Record<string, unknown>, @UploadedFile() file: Express.Multer.File) {
    // Multipart booleans arrive as strings. Validate after explicit conversion.
    if (body.isHandbook !== undefined && !['true', 'false'].includes(String(body.isHandbook))) throw new BadRequestException('Invalid handbook flag.');
    const dto = plainToInstance(DocumentDto, { ...body, ...(body.isHandbook !== undefined ? { isHandbook: body.isHandbook === 'true' } : {}) });
    try { await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true }); } catch { throw new BadRequestException('Check the document title, category and employee.'); }
    if (!file) throw new BadRequestException('Choose a file to upload.');
    const document = await this.documents.create(a, dto, file);
    if (document.isHandbook) {
      try { await this.ai.ingest(a, document.id); return { ...document, ingestStatus: 'READY' }; }
      catch { return { ...document, ingestStatus: 'FAILED' }; }
    }
    return document;
  }
  @Get(':id/download') async download(@CurrentActor() a: Actor, @Param('id') id: string) {
    const { stream, document } = await this.documents.download(a, id);
    const extension = ({ 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'text/plain': '.txt' } as Record<string, string>)[document.mimeType] ?? '';
    return new StreamableFile(stream, { type: 'application/octet-stream', disposition: `attachment; filename="document${extension}"; filename*=UTF-8''${encodeURIComponent(document.title + extension)}`, length: document.size });
  }
  @Delete(':id') remove(@CurrentActor() a: Actor, @Param('id') id: string) { return this.documents.remove(a, id); }
}
