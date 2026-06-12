import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AvailabilityStatus, JobType, MomoProvider } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE — personal info
// ─────────────────────────────────────────────────────────────────────────────

export class UpdatePersonalInfoDto {
  /**
   * fullNames is accepted for compatibility with AuthService.selectRole()
   * which seeds the profile with a single display name string on first login.
   * When provided, it is stored directly as fullName.
   * Prefer firstName + lastName for all other profile updates.
   */
  @IsOptional() @IsString() fullNames?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsBoolean() availableToWork?: boolean;
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE — professional summary
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateProfessionalSummaryDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() professionalTitle?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) industries?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredJobCategories?: string[];
  @IsOptional()
  @IsArray()
  @IsEnum(JobType, { each: true })
  preferredJobTypes?: JobType[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE — skills
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateSkillsDto {
  @IsArray()
  @IsString({ each: true })
  skills!: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// WORK HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export class CreateWorkHistoryDto {
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

export class UpdateWorkHistoryDto {
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// EDUCATION
// ─────────────────────────────────────────────────────────────────────────────

export class CreateEducationDto {
  @IsOptional() @IsString() school?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() fieldOfStudy?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

export class UpdateEducationDto {
  @IsOptional() @IsString() school?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() fieldOfStudy?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

export class CreateCertificationDto {
  @IsString() name!: string;
  @IsOptional() @IsString() issuer?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() fileUrl?: string;
}

export class UpdateCertificationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() issuer?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() fileUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT DETAILS
// ─────────────────────────────────────────────────────────────────────────────

export class UpdatePaymentDetailsDto {
  @IsOptional() @IsEnum(MomoProvider) mobileMoneyProvider?: MomoProvider;
  @IsOptional() @IsString() mobileMoneyNumber?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountNumber?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC
// ─────────────────────────────────────────────────────────────────────────────

export class SubmitKYCDto {
  @IsString() frontIdImageUrl!: string;
  @IsOptional() @IsString() backIdImageUrl?: string;
  @IsOptional() @IsString() selfieImageUrl?: string;
  @IsString() documentType!: string;
}

export class UpsertWorkHistoryItemDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

export class UpsertEducationItemDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() school?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() fieldOfStudy?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

export class UpsertCertificationItemDto {
  @IsOptional() @IsString() id?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() issuer?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() fileUrl?: string;
}

export class UpsertPaymentAccountItemDto {
  @IsEnum(MomoProvider) provider!: MomoProvider;
  @IsString() phone!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpsertWorkerProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;
  @IsOptional() @IsString() professionalTitle?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) industries?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredJobCategories?: string[];
  @IsOptional()
  @IsArray()
  @IsEnum(JobType, { each: true })
  preferredJobTypes?: JobType[];
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertWorkHistoryItemDto)
  workHistories?: UpsertWorkHistoryItemDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertEducationItemDto)
  educations?: UpsertEducationItemDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCertificationItemDto)
  certifications?: UpsertCertificationItemDto[];
  @IsOptional() @IsEnum(MomoProvider) mobileMoneyProvider?: MomoProvider;
  @IsOptional() @IsString() mobileMoneyNumber?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertPaymentAccountItemDto)
  paymentAccounts?: UpsertPaymentAccountItemDto[];
}

export class CreatePaymentAccountDto {
  @IsEnum(MomoProvider) provider!: MomoProvider;
  @IsString() phone!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpdatePaymentAccountDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class WorkerNotificationSettingsDto {
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() jobsEnabled?: boolean;
  @IsOptional() @IsBoolean() messagesEnabled?: boolean;
}
