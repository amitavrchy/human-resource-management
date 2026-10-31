import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { type Actor, requireAdmin, requireRecruiting } from '../common/context.js';
import { JdDto } from '../common/dto.js';
import { FilesService } from '../common/files.service.js';
import { RecruitingService } from '../recruiting/recruiting.service.js';

export interface Screening { score: number; summary: string; reasons: string[]; missingSkills: string[] }
interface ChatResponse { answer: string; citations: { id: string; documentId: string; title: string; excerpt: string }[] }
@Injectable()
export class AiService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService, private readonly files: FilesService, private readonly recruiting: RecruitingService) {}
  private async call<T>(path: string, body: unknown): Promise<T> {
    const token = this.config.get<string>('AI_SERVICE_TOKEN');
    if (!token || token.length < 32) throw new ServiceUnavailableException('AI service is not configured. Ask your workspace administrator.');
    let response: globalThis.Response;
    try { response = await fetch(`${this.config.get<string>('AI_SERVICE_URL') ?? 'http://127.0.0.1:8001'}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }); }
    catch { throw new ServiceUnavailableException('AI service is unavailable. Please try again.'); }
    if (!response.ok) {
      if (response.status === 422) throw new BadRequestException('AI could not process this content. Use readable text and try again.');
      throw new ServiceUnavailableException('AI is unavailable or not configured. Please try again later.');
    }
    return response.json() as Promise<T>;
  }
  async status() {
    try {
      const response = await fetch(`${this.config.get<string>('AI_SERVICE_URL') ?? 'http://127.0.0.1:8001'}/health`, { signal: AbortSignal.timeout(3000) });
      const data = await response.json() as { configured?: boolean };
      return { available: response.ok && data.configured === true && !!this.config.get<string>('AI_SERVICE_TOKEN') };
    } catch { return { available: false }; }
  }
  async jd(actor: Actor, dto: JdDto) {
    requireRecruiting(actor);
    if (actor.role === 'MANAGER') {
      if (!dto.jobId) throw new BadRequestException('Choose one of your assigned roles to draft its description.');
      await this.recruiting.job(actor, dto.jobId);
    }
    const { jobId: _jobId, ...request } = dto;
    const result = await this.call<{ markdown: string }>('/v1/jd/generate', request);
    if (typeof result.markdown !== 'string' || !result.markdown.trim()) throw new ServiceUnavailableException('No description was returned. Please try again.');
    await this.db.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'ai.jd_generated', entityType: 'Job' } });
    return { markdown: result.markdown.slice(0, 30000) };
  }
  async screen(actor: Actor, candidateId: string) {
    requireRecruiting(actor, true);
    await this.recruiting.candidate(actor, candidateId);
    const candidate = await this.db.candidate.findFirstOrThrow({ where: { id: candidateId, organizationId: actor.organizationId }, include: { job: true } });
    let text = candidate.resumeText;
    if (!text && candidate.resumeUrl) {
      const bytes = await this.files.bytes(candidate.resumeUrl);
      if (bytes.subarray(0, 5).toString() !== '%PDF-') text = bytes.toString('utf8').slice(0, 60000);
      else text = (await this.call<{ text: string }>('/v1/extract-text', { data: bytes.toString('base64') })).text?.slice(0, 60000);
    }
    if (!text || text.trim().length < 20) throw new BadRequestException('Upload a readable resume or paste at least 20 characters of resume text.');
    const result = await this.call<Screening>('/v1/resume/screen', { jobDescription: candidate.job.descriptionMd, resumeText: text });
    if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100 || typeof result.summary !== 'string' || !Array.isArray(result.reasons) || !Array.isArray(result.missingSkills)) throw new ServiceUnavailableException('AI returned an invalid assessment. Please try again.');
    await this.db.$transaction(async tx => {
      const updated = await tx.candidate.updateMany({ where: { id: candidateId, organizationId: actor.organizationId, updatedAt: candidate.updatedAt }, data: { resumeText: text, aiScore: result.score, aiSummary: result.summary, aiReasonsJson: { reasons: result.reasons, missingSkills: result.missingSkills } } });
      if (!updated.count) throw new ConflictException('Candidate changed during screening. Please run it again.');
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'ai.resume_screened', entityType: 'Candidate', entityId: candidateId } });
    });
    return result;
  }
  async ingest(actor: Actor, documentId: string) {
    requireAdmin(actor);
    const document = await this.db.document.findFirst({ where: { id: documentId, organizationId: actor.organizationId, isHandbook: true, employeeId: null, category: 'policy' } });
    if (!document) throw new NotFoundException('Company handbook not found.');
    await this.db.document.update({ where: { id: documentId, organizationId: actor.organizationId }, data: { ingestStatus: 'PROCESSING' } });
    try {
      let text = document.contentText;
      if (!text && document.mimeType === 'application/pdf') text = (await this.call<{ text: string }>('/v1/extract-text', { data: (await this.files.bytes(document.fileUrl)).toString('base64') })).text;
      if (!text || text.length < 20) throw new BadRequestException('Add readable handbook text or upload a text-based PDF.');
      const result = await this.call<{ chunks: number }>('/v1/handbook/ingest', { orgId: actor.organizationId, docId: document.id, title: document.title, text });
      await this.db.$transaction(async tx => {
        await tx.document.update({ where: { id: document.id, organizationId: actor.organizationId }, data: { ingestStatus: 'READY', contentText: text } });
        await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'ai.handbook_indexed', entityType: 'Document', entityId: document.id } });
      });
      return result;
    } catch (error) {
      await this.db.document.updateMany({ where: { id: document.id, organizationId: actor.organizationId }, data: { ingestStatus: 'FAILED' } });
      throw error;
    }
  }
  async chat(actor: Actor, message: string) {
    const documents = await this.db.document.findMany({ where: { organizationId: actor.organizationId, category: 'policy', employeeId: null, isHandbook: true, ingestStatus: 'READY' }, select: { id: true }, take: 500 });
    if (!documents.length) return { answer: "I don't see that in the handbook. Ask your HR team to upload and index a company policy first.", citations: [] };
    const result = await this.call<ChatResponse>('/v1/handbook/chat', { orgId: actor.organizationId, message, documentIds: documents.map(doc => doc.id) });
    const allowed = new Set(documents.map(doc => doc.id));
    const citations = result.citations?.filter(citation => allowed.has(citation.documentId)) ?? [];
    return citations.length ? { answer: result.answer, citations } : { answer: "I don't see that in the handbook. Please ask your HR team for guidance.", citations: [] };
  }
}
