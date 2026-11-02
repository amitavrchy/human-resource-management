import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../common/access.service.js';
import { type Actor, requireRecruiting } from '../common/context.js';
import {
  CandidateDto,
  CandidateUpdateDto,
  FeedbackDto,
  HireDto,
  JobDto,
  StageDto,
  UpdateJobDto,
} from '../common/dto.js';
import { serializable } from '../common/database.js';
import { PeopleService } from '../people/people.service.js';
import { FilesService } from '../common/files.service.js';

const candidateSelect = {
  id: true,
  jobId: true,
  name: true,
  email: true,
  resumeText: true,
  stage: true,
  aiScore: true,
  aiSummary: true,
  aiReasonsJson: true,
  notes: true,
  feedbackJson: true,
  employeeId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CandidateSelect;
@Injectable()
export class RecruitingService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: AccessService,
    private readonly people: PeopleService,
    private readonly files: FilesService,
  ) {}
  jobWhere(actor: Actor): Prisma.JobWhereInput {
    return {
      organizationId: actor.organizationId,
      ...(actor.role === 'MANAGER'
        ? { hiringManagerId: actor.employeeId ?? '__none__' }
        : {}),
    };
  }
  async job(actor: Actor, id: string) {
    requireRecruiting(actor);
    const job = await this.db.job.findFirst({
      where: { id, ...this.jobWhere(actor) },
      include: {
        candidates: { select: candidateSelect, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!job) throw new NotFoundException('Job not found.');
    return job;
  }
  jobs(actor: Actor) {
    requireRecruiting(actor);
    return this.db.job.findMany({
      where: this.jobWhere(actor),
      include: { _count: { select: { candidates: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
  }
  async saveJob(actor: Actor, dto: JobDto | UpdateJobDto, id?: string) {
    requireRecruiting(actor, true);
    return this.db.$transaction(async (tx) => {
      await this.access.reference(tx, actor, 'employee', dto.hiringManagerId);
      const data = {
        title: dto.title,
        department: dto.department,
        location: dto.location,
        descriptionMd: dto.descriptionMd,
        status: dto.status,
        hiringManagerId:
          dto.hiringManagerId === undefined
            ? undefined
            : dto.hiringManagerId || null,
      };
      const job = id
        ? await tx.job.update({
            where: { id, organizationId: actor.organizationId },
            data,
          })
        : await tx.job.create({
            data: {
              ...data,
              title: dto.title!,
              descriptionMd: dto.descriptionMd!,
              status: dto.status!,
              organizationId: actor.organizationId,
            },
          });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: `job.${id ? 'updated' : 'created'}`,
          entityType: 'Job',
          entityId: job.id,
        },
      });
      return job;
    });
  }
  async removeJob(actor: Actor, id: string) {
    requireRecruiting(actor, true);
    const job = await this.job(actor, id);
    if (job.candidates.length)
      throw new ConflictException(
        'Close a job with candidate history instead of deleting it.',
      );
    await this.db.$transaction(async (tx) => {
      await tx.job.delete({
        where: { id, organizationId: actor.organizationId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'job.deleted',
          entityType: 'Job',
          entityId: id,
        },
      });
    });
    return { success: true };
  }
  async candidate(actor: Actor, id: string) {
    requireRecruiting(actor);
    const candidate = await this.db.candidate.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        job: this.jobWhere(actor),
      },
      select: { ...candidateSelect, job: true, resumeUrl: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found.');
    const { resumeUrl, ...safe } = candidate;
    return { ...safe, hasResume: !!resumeUrl };
  }
  async addCandidate(actor: Actor, jobId: string, dto: CandidateDto) {
    requireRecruiting(actor, true);
    const job = await this.job(actor, jobId);
    if (job.status !== 'OPEN')
      throw new ConflictException('Open the role before adding a candidate.');
    return this.db.$transaction(async (tx) => {
      const candidate = await tx.candidate.create({
        data: {
          name: dto.name,
          email: dto.email,
          resumeText: dto.resumeText,
          notes: dto.notes,
          organizationId: actor.organizationId,
          jobId,
        },
        select: candidateSelect,
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'candidate.created',
          entityType: 'Candidate',
          entityId: candidate.id,
        },
      });
      return candidate;
    });
  }
  async updateCandidate(actor: Actor, id: string, dto: CandidateUpdateDto) {
    requireRecruiting(actor, true);
    await this.candidate(actor, id);
    return this.db.$transaction(async (tx) => {
      const candidate = await tx.candidate.update({
        where: { id, organizationId: actor.organizationId },
        data: {
          name: dto.name,
          email: dto.email,
          resumeText: dto.resumeText,
          notes: dto.notes,
          ...(dto.resumeText !== undefined
            ? { aiScore: null, aiSummary: null, aiReasonsJson: Prisma.DbNull }
            : {}),
        },
        select: candidateSelect,
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'candidate.updated',
          entityType: 'Candidate',
          entityId: id,
          metaJson: { fields: Object.keys(dto) },
        },
      });
      return candidate;
    });
  }
  async stage(actor: Actor, id: string, dto: StageDto) {
    requireRecruiting(actor, true);
    await this.candidate(actor, id);
    if (dto.stage === 'HIRED')
      throw new BadRequestException(
        'Use the hire action to create an employee and onboarding checklist.',
      );
    return serializable(this.db, async (tx) => {
      const current = await tx.candidate.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId },
      });
      if (current.stage === 'HIRED')
        throw new ConflictException('A hired candidate cannot be moved.');
      const result = await tx.candidate.update({
        where: { id, organizationId: actor.organizationId },
        data: { stage: dto.stage },
        select: candidateSelect,
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'candidate.stage_changed',
          entityType: 'Candidate',
          entityId: id,
          metaJson: { from: current.stage, to: dto.stage },
        },
      });
      return result;
    });
  }
  async hire(actor: Actor, id: string, dto: HireDto) {
    requireRecruiting(actor, true);
    return serializable(this.db, async (tx) => {
      const candidate = await tx.candidate.findFirst({
        where: { id, organizationId: actor.organizationId },
        include: { job: true },
      });
      if (!candidate) throw new NotFoundException('Candidate not found.');
      if (candidate.employeeId)
        return tx.employee.findFirstOrThrow({
          where: {
            id: candidate.employeeId,
            organizationId: actor.organizationId,
          },
        });
      if (candidate.stage !== 'OFFER')
        throw new ConflictException(
          'Move the candidate to Offer before hiring.',
        );
      if (candidate.job.status !== 'OPEN')
        throw new ConflictException('Reopen the job before hiring.');
      await this.people.validateReferences(tx, actor, dto);
      const [firstName, ...rest] = candidate.name.trim().split(/\s+/);
      const employee = await this.people.createInTransaction(tx, actor, {
        departmentId: dto.departmentId,
        locationId: dto.locationId,
        managerId: dto.managerId,
        startDate: dto.startDate,
        firstName,
        lastName: rest.join(' ') || firstName,
        workEmail: candidate.email,
        title: candidate.job.title,
        status: 'ONBOARDING',
      });
      await tx.candidate.update({
        where: { id, organizationId: actor.organizationId },
        data: { stage: 'HIRED', employeeId: employee.id },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'candidate.hired',
          entityType: 'Candidate',
          entityId: id,
          metaJson: { employeeId: employee.id },
        },
      });
      return employee;
    });
  }
  async feedback(actor: Actor, id: string, dto: FeedbackDto) {
    await this.candidate(actor, id);
    return serializable(this.db, async (tx) => {
      const candidate = await tx.candidate.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId },
      });
      const feedback = Array.isArray(candidate.feedbackJson)
        ? candidate.feedbackJson
        : [];
      await tx.candidate.update({
        where: { id, organizationId: actor.organizationId },
        data: {
          feedbackJson: [
            ...feedback,
            {
              comment: dto.comment,
              rating: dto.rating,
              authorUserId: actor.userId,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'candidate.feedback_added',
          entityType: 'Candidate',
          entityId: id,
        },
      });
      return { success: true };
    });
  }
  async uploadResume(actor: Actor, id: string, file: Express.Multer.File) {
    requireRecruiting(actor, true);
    await this.candidate(actor, id);
    const stored = await this.files.store(file, true);
    const previous = await this.db.candidate.findFirstOrThrow({
      where: { id, organizationId: actor.organizationId },
      select: { resumeUrl: true },
    });
    try {
      await this.db.$transaction(async (tx) => {
        await tx.candidate.update({
          where: { id, organizationId: actor.organizationId },
          data: {
            resumeUrl: stored.key,
            resumeText: stored.text?.slice(0, 60000) ?? null,
            aiScore: null,
            aiSummary: null,
            aiReasonsJson: Prisma.DbNull,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: 'candidate.resume_uploaded',
            entityType: 'Candidate',
            entityId: id,
          },
        });
      });
    } catch (error) {
      await this.files.remove(stored.key);
      throw error;
    }
    if (previous.resumeUrl) await this.files.remove(previous.resumeUrl);
    return { success: true, textExtracted: !!stored.text };
  }
  async resume(actor: Actor, id: string) {
    await this.candidate(actor, id);
    const candidate = await this.db.candidate.findFirstOrThrow({
      where: { id, organizationId: actor.organizationId },
    });
    if (!candidate.resumeUrl)
      throw new NotFoundException('No resume uploaded.');
    const buffer = await this.files.bytes(candidate.resumeUrl);
    return {
      buffer,
      filename:
        buffer.subarray(0, 5).toString() === '%PDF-'
          ? 'resume.pdf'
          : 'resume.txt',
    };
  }
  async removeCandidate(actor: Actor, id: string) {
    requireRecruiting(actor, true);
    await this.candidate(actor, id);
    const removed = await serializable(this.db, async (tx) => {
      const candidate = await tx.candidate.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId },
      });
      if (candidate.stage === 'HIRED' || candidate.employeeId)
        throw new ConflictException(
          'Hired candidates retain their hiring history.',
        );
      await tx.candidate.delete({
        where: { id, organizationId: actor.organizationId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'candidate.deleted',
          entityType: 'Candidate',
          entityId: id,
        },
      });
      return candidate;
    });
    if (removed.resumeUrl) await this.files.remove(removed.resumeUrl);
    return { success: true };
  }
}
