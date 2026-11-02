import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, type Actor } from '../common/context.js';
import { EmployeeDto, PageDto, UpdateEmployeeDto } from '../common/dto.js';
import { PeopleService } from './people.service.js';

@Controller('employees')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}
  @Get() list(@CurrentActor() actor: Actor, @Query() query: PageDto) {
    return this.people.list(actor, query);
  }
  @Get('org-tree') tree(@CurrentActor() actor: Actor) {
    return this.people.tree(actor);
  }
  @Get(':id') detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.people.detail(actor, id);
  }
  @Post() create(@CurrentActor() actor: Actor, @Body() dto: EmployeeDto) {
    return this.people.create(actor, dto);
  }
  @Patch(':id') update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.people.update(actor, id, dto);
  }
  @Delete(':id') archive(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ) {
    return this.people.archive(actor, id);
  }
}
