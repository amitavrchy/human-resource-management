import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CurrentActor,
  requireAdmin,
  requireRecruiting,
  type Actor,
} from '../common/context.js';
import { JobTemplateDto } from '../common/dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('job-templates')
export class JobTemplatesController {
  constructor(private readonly db: PrismaService) {}
  @Get() list(@CurrentActor() actor: Actor) {
    requireRecruiting(actor);
    return this.db.jobTemplate.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: 'asc' },
    });
  }
  @Post() create(@CurrentActor() actor: Actor, @Body() dto: JobTemplateDto) {
    return this.save(actor, dto);
  }
  @Patch(':id') update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() dto: JobTemplateDto,
  ) {
    return this.save(actor, dto, id);
  }
  private save(actor: Actor, dto: JobTemplateDto, id?: string) {
    requireAdmin(actor);
    return this.db.$transaction(async (tx) => {
      const data = {
        name: dto.name,
        title: dto.title,
        department: dto.department,
        descriptionMd: dto.descriptionMd,
      };
      const record = id
        ? await tx.jobTemplate.update({
            where: { id, organizationId: actor.organizationId },
            data,
          })
        : await tx.jobTemplate.create({
            data: { ...data, organizationId: actor.organizationId },
          });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: `job_template.${id ? 'updated' : 'created'}`,
          entityType: 'JobTemplate',
          entityId: record.id,
        },
      });
      return record;
    });
  }
  @Delete(':id') remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    requireAdmin(actor);
    return this.db.$transaction(async (tx) => {
      await tx.jobTemplate.delete({
        where: { id, organizationId: actor.organizationId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: 'job_template.deleted',
          entityType: 'JobTemplate',
          entityId: id,
        },
      });
      return { success: true };
    });
  }
}
