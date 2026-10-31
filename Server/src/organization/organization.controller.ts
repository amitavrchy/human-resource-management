import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentActor, type Actor } from '../common/context.js';
import { LocationDto, MemberDto, NameDto, OrganizationDto, PolicyDto, RoleDto, TemplateDto } from '../common/dto.js';
import { OrganizationService } from './organization.service.js';

@Controller()
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}
  @Get('organization/metadata') metadata(@CurrentActor() a: Actor) { return this.org.metadata(a); }
  @Patch('organization') organization(@CurrentActor() a: Actor, @Body() d: OrganizationDto) { return this.org.organization(a, d); }
  @Get('departments') async departments(@CurrentActor() a: Actor) { return (await this.org.metadata(a)).departments; }
  @Get('locations') async locations(@CurrentActor() a: Actor) { return (await this.org.metadata(a)).locations; }
  @Get('leave-policies') async policies(@CurrentActor() a: Actor) { return (await this.org.metadata(a)).policies; }
  @Post('departments') department(@CurrentActor() a: Actor, @Body() d: NameDto) { return this.org.save(a, 'department', d); }
  @Patch('departments/:id') updateDepartment(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: NameDto) { return this.org.save(a, 'department', d, id); }
  @Delete('departments/:id') removeDepartment(@CurrentActor() a: Actor, @Param('id') id: string) { return this.org.remove(a, 'department', id); }
  @Post('locations') location(@CurrentActor() a: Actor, @Body() d: LocationDto) { return this.org.save(a, 'location', d); }
  @Patch('locations/:id') updateLocation(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: LocationDto) { return this.org.save(a, 'location', d, id); }
  @Delete('locations/:id') removeLocation(@CurrentActor() a: Actor, @Param('id') id: string) { return this.org.remove(a, 'location', id); }
  @Post('leave-policies') policy(@CurrentActor() a: Actor, @Body() d: PolicyDto) { return this.org.save(a, 'policy', d); }
  @Patch('leave-policies/:id') updatePolicy(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: PolicyDto) { return this.org.save(a, 'policy', d, id); }
  @Delete('leave-policies/:id') removePolicy(@CurrentActor() a: Actor, @Param('id') id: string) { return this.org.remove(a, 'policy', id); }
  @Post('onboarding-templates') template(@CurrentActor() a: Actor, @Body() d: TemplateDto) { return this.org.save(a, 'template', d); }
  @Patch('onboarding-templates/:id') updateTemplate(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: TemplateDto) { return this.org.save(a, 'template', d, id); }
  @Delete('onboarding-templates/:id') removeTemplate(@CurrentActor() a: Actor, @Param('id') id: string) { return this.org.remove(a, 'template', id); }
  @Post('onboarding-templates/:id/default') defaultTemplate(@CurrentActor() a: Actor, @Param('id') id: string) { return this.org.defaultTemplate(a, id); }
  @Get('members') members(@CurrentActor() a: Actor) { return this.org.members(a); }
  @Post('members') member(@CurrentActor() a: Actor, @Body() d: MemberDto) { return this.org.createMember(a, d); }
  @Patch('members/:id/role') role(@CurrentActor() a: Actor, @Param('id') id: string, @Body() d: RoleDto) { return this.org.changeRole(a, id, d); }
}
