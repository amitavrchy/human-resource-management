import { Body, Controller, Delete, Get, Param, Patch, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentActor, type Actor } from '../common/context.js';
import { CandidateDto, CandidateUpdateDto, FeedbackDto, HireDto, JobDto, StageDto, UpdateJobDto } from '../common/dto.js';
import { RecruitingService } from './recruiting.service.js';

@Controller()
export class RecruitingController {
  constructor(private readonly recruiting: RecruitingService) {}
  @Get('jobs') jobs(@CurrentActor() a: Actor) { return this.recruiting.jobs(a); }
  @Get('jobs/:id') job(@CurrentActor() a: Actor, @Param('id') id: string) { return this.recruiting.job(a, id); }
  @Post('jobs') createJob(@CurrentActor() a: Actor, @Body() d: JobDto) { return this.recruiting.saveJob(a, d); }
  @Patch('jobs/:id') updateJob(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: UpdateJobDto) { return this.recruiting.saveJob(a, d, id); }
  @Delete('jobs/:id') removeJob(@CurrentActor() a: Actor, @Param('id') id: string) { return this.recruiting.removeJob(a, id); }
  @Get('jobs/:id/candidates') async candidates(@CurrentActor() a: Actor, @Param('id') id: string) { return (await this.recruiting.job(a, id)).candidates; }
  @Post('jobs/:id/candidates') addCandidate(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: CandidateDto) { return this.recruiting.addCandidate(a, id, d); }
  @Get('candidates/:id') candidate(@CurrentActor() a: Actor, @Param('id') id: string) { return this.recruiting.candidate(a, id); }
  @Delete('candidates/:id') removeCandidate(@CurrentActor() a: Actor, @Param('id') id: string) { return this.recruiting.removeCandidate(a, id); }
  @Patch('candidates/:id') updateCandidate(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: CandidateUpdateDto) { return this.recruiting.updateCandidate(a, id, d); }
  @Patch('candidates/:id/stage') stage(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: StageDto) { return this.recruiting.stage(a, id, d); }
  @Post('candidates/:id/hire') hire(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: HireDto) { return this.recruiting.hire(a, id, d); }
  @Post('candidates/:id/feedback') feedback(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: FeedbackDto) { return this.recruiting.feedback(a, id, d); }
  @Post('candidates/:id/resume') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })) uploadResume(@CurrentActor() a: Actor, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) { return this.recruiting.uploadResume(a, id, file); }
  @Get('candidates/:id/resume') async resume(@CurrentActor() a: Actor, @Param('id') id: string) { return new StreamableFile(await this.recruiting.resume(a, id), { type: 'application/octet-stream', disposition: 'attachment; filename="resume"' }); }
}
