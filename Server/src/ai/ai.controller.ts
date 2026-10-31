import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentActor, type Actor } from '../common/context.js';
import { ChatDto, IngestDto, JdDto, ScreenDto } from '../common/dto.js';
import { AiService } from './ai.service.js';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Get('status') status() { return this.ai.status(); }
  @Post('jd') jd(@CurrentActor() a: Actor, @Body() d: JdDto) { return this.ai.jd(a, d); }
  @Post('screen-resume') screen(@CurrentActor() a: Actor, @Body() d: ScreenDto) { return this.ai.screen(a, d.candidateId); }
  @Post('ingest-handbook') ingest(@CurrentActor() a: Actor, @Body() d: IngestDto) { return this.ai.ingest(a, d.documentId); }
  @Post('chat') chat(@CurrentActor() a: Actor, @Body() d: ChatDto) { return this.ai.chat(a, d.message); }
}
