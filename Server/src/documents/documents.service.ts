import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../common/access.service.js';
import { type Actor, isAdmin, requireAdmin } from '../common/context.js';
import { DocumentDto } from '../common/dto.js';
import { FilesService } from '../common/files.service.js';

const select = { id: true, title: true, category: true, mimeType: true, size: true, isHandbook: true, ingestStatus: true, employeeId: true, createdAt: true, employee: { select: { firstName: true, lastName: true } } } as const;
@Injectable()
export class DocumentsService {
  constructor(private readonly db: PrismaService, private readonly access: AccessService, private readonly files: FilesService) {}
  where(actor: Actor) { return { organizationId: actor.organizationId, ...(!isAdmin(actor) ? { OR: [{ employeeId: null, category: 'policy' }, { employeeId: actor.employeeId ?? '__none__' }] } : {}) }; }
  list(actor: Actor) { return this.db.document.findMany({ where: this.where(actor), select, orderBy: { createdAt: 'desc' }, take: 500 }); }
  async create(actor: Actor, dto: DocumentDto, file?: Express.Multer.File) {
    requireAdmin(actor);
    if (dto.employeeId) await this.access.employee(actor, dto.employeeId);
    if (dto.category !== 'policy' && !dto.employeeId) throw new BadRequestException('Personal files and contracts require an employee.');
    if (dto.isHandbook && (dto.category !== 'policy' || dto.employeeId)) throw new BadRequestException('Only company-wide policies may be indexed as handbooks.');
    if (!file && !dto.contentText?.trim()) throw new BadRequestException('Upload a file or enter document text.');
    const stored = await this.files.store(file ?? { buffer: Buffer.from(dto.contentText!, 'utf8'), size: Buffer.byteLength(dto.contentText!, 'utf8'), mimetype: 'text/plain' } as Express.Multer.File);
    try {
      return await this.db.$transaction(async tx => {
        const document = await tx.document.create({ data: { organizationId: actor.organizationId, title: dto.title, category: dto.category, employeeId: dto.employeeId || null, isHandbook: dto.isHandbook ?? false, fileUrl: stored.key, mimeType: stored.mimeType, size: stored.size, contentText: dto.contentText || stored.text, ingestStatus: dto.isHandbook ? 'PENDING' : 'NONE' }, select });
        await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'document.uploaded', entityType: 'Document', entityId: document.id } });
        return document;
      });
    } catch (error) { await this.files.remove(stored.key); throw error; }
  }
  async download(actor: Actor, id: string) {
    const document = await this.db.document.findFirst({ where: { ...this.where(actor), id } });
    if (!document) throw new NotFoundException('Document not found.');
    return { stream: await this.files.stream(document.fileUrl), document };
  }
  async remove(actor: Actor, id: string) {
    requireAdmin(actor);
    const document = await this.db.document.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!document) throw new NotFoundException('Document not found.');
    await this.db.$transaction(async tx => {
      await tx.document.delete({ where: { id, organizationId: actor.organizationId } });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'document.deleted', entityType: 'Document', entityId: id } });
    });
    // Chat requests always send a fresh allowlist from the DB, so deleted sources are inaccessible immediately.
    await this.files.remove(document.fileUrl);
    return { success: true };
  }
}
