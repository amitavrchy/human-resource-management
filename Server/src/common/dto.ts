import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CandidateStage, EmploymentStatus, JobStatus, OnboardingTaskStatus, OrgRole } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class LoginDto {
  @IsEmail() @MaxLength(254) @Transform(({ value }: { value: string }) => value?.trim().toLowerCase()) email: string;
  @IsString() @Length(1, 72) password: string;
  @IsOptional() @IsString() @MaxLength(100) organizationSlug?: string;
}
export class RegisterDto extends LoginDto {
  @IsString() @Length(12, 72) declare password: string;
  @IsString() @Transform(trim) @Length(2, 100) name: string;
  @IsString() @Transform(trim) @Length(2, 120) organizationName: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(3, 60) slug: string;
}
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(100) departmentId?: string;
  @IsOptional() @IsString() @MaxLength(100) locationId?: string;
  @IsOptional() @IsEnum(EmploymentStatus) status?: EmploymentStatus;
}
export class EmployeeDto {
  @IsString() @Transform(trim) @Length(1, 80) firstName: string;
  @IsString() @Transform(trim) @Length(1, 80) lastName: string;
  @IsEmail() @MaxLength(254) @Transform(({ value }: { value: string }) => value?.trim().toLowerCase()) workEmail: string;
  @IsOptional() @IsEmail() personalEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(100) departmentId?: string;
  @IsOptional() @IsString() @MaxLength(100) locationId?: string;
  @IsOptional() @IsString() @MaxLength(100) managerId?: string;
  @IsOptional() @IsEnum(EmploymentStatus) status?: EmploymentStatus;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) birthDate?: string;
  @IsOptional() @IsString() @MaxLength(100) emergencyName?: string;
  @IsOptional() @IsString() @MaxLength(40) emergencyPhone?: string;
}
export class UpdateEmployeeDto extends PartialType(EmployeeDto) {}
export class NameDto {
  @IsString() @Transform(trim) @Length(1, 120) name: string;
}
export class LocationDto extends NameDto {
  @IsString() @Matches(/^[A-Z]{2}$/) country: string;
}
export class PolicyDto extends NameDto {
  @IsString() @Matches(/^[A-Z_]{2,20}$/) code: string;
  @IsNumber() @Min(0) @Max(366) annualDays: number;
}
export class OrganizationDto extends NameDto {
  @IsString() @MaxLength(80) timezone: string;
}
export class LeaveDto {
  @IsString() @Length(1, 100) employeeId: string;
  @IsString() @Length(1, 100) policyId: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
export class JobDto {
  @IsString() @Transform(trim) @Length(2, 160) title: string;
  @IsOptional() @IsString() @MaxLength(120) department?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsString() @Length(20, 30000) descriptionMd: string;
  @IsEnum(JobStatus) status: JobStatus;
}
export class UpdateJobDto extends PartialType(JobDto) {}
export class CandidateDto {
  @IsString() @Transform(trim) @Length(2, 120) name: string;
  @IsEmail() @Transform(({ value }: { value: string }) => value?.trim().toLowerCase()) email: string;
  @IsOptional() @IsString() @MaxLength(60000) resumeText?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
}
export class CandidateUpdateDto extends PartialType(CandidateDto) {}
export class StageDto { @IsEnum(CandidateStage) stage: CandidateStage; }
export class HireDto {
  @IsOptional() @IsString() @MaxLength(100) departmentId?: string;
  @IsOptional() @IsString() @MaxLength(100) locationId?: string;
  @IsOptional() @IsString() @MaxLength(100) managerId?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
}
export class TaskDto {
  @IsString() @Length(1, 100) taskId: string;
  @IsEnum(OnboardingTaskStatus) status: OnboardingTaskStatus;
}
export class TemplateTaskDto {
  @IsString() @Transform(trim) @Length(1, 200) title: string;
}
export class TemplateDto extends NameDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => TemplateTaskDto) tasks: TemplateTaskDto[];
}
export class DocumentDto {
  @IsString() @Transform(trim) @Length(2, 160) title: string;
  @IsIn(['policy', 'personal', 'contract']) category: string;
  @IsOptional() @IsString() @MaxLength(100) employeeId?: string;
  @IsOptional() @IsBoolean() isHandbook?: boolean;
  @IsOptional() @IsString() @MaxLength(200000) contentText?: string;
}
export class GoalDto {
  @IsString() @Length(1, 100) employeeId: string;
  @IsString() @Transform(trim) @Length(3, 200) title: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
}
export class GoalProgressDto { @IsInt() @Min(0) @Max(100) progress: number; }
export class ReviewDto {
  @IsString() @Length(1, 100) employeeId: string;
  @Matches(/^\d{4}-Q[1-4]$/) quarter: string;
  @IsString() @Length(5, 5000) achievements: string;
  @IsString() @Length(5, 5000) improvements: string;
  @IsInt() @Min(1) @Max(5) rating: number;
}
export class MemberDto {
  @IsString() @Transform(trim) @Length(2, 100) name: string;
  @IsEmail() @Transform(({ value }: { value: string }) => value?.trim().toLowerCase()) email: string;
  @IsString() @Length(12, 72) password: string;
  @IsEnum(OrgRole) role: OrgRole;
  @IsOptional() @IsString() @MaxLength(100) employeeId?: string;
}
export class RoleDto { @IsEnum(OrgRole) role: OrgRole; }
export class FeedbackDto {
  @IsString() @Length(3, 3000) comment: string;
  @IsInt() @Min(1) @Max(5) rating: number;
}
export class JdDto {
  @IsString() @Length(2, 160) title: string;
  @IsString() @Length(1, 120) department: string;
  @IsString() @Length(1, 80) level: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) mustHaves: string[];
  @IsIn(['professional', 'friendly', 'concise']) tone: string;
}
export class ChatDto { @IsString() @Transform(trim) @Length(2, 3000) message: string; }
export class ScreenDto { @IsString() @Length(1, 100) candidateId: string; }
export class IngestDto { @IsString() @Length(1, 100) documentId: string; }
