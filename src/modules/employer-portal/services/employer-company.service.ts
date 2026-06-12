import { Injectable } from '@nestjs/common';
import {
  EngagementStatus,
  type EmployerProfile,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import type { UpdateCompanyDto } from '../dto/update-company.dto';
import { EmployerProfilesRepository } from '../../employer-profiles/repositories/employer-profiles.repository';
import { FilesService } from '../../files/services/files.service';
import type { CloudinaryUploadResult } from '../../files/services/files.service';
import { EmployerContextService } from './employer-context.service';

export type CompanyProfileEntity = {
  companyId: string;
  name: string;
  tagline: string | null;
  logo: string | null;
  industry: string | null;
  size: string | null;
  bio: string | null;
  location: { city: string; country: string } | null;
  website: string | null;
  email: string | null;
  verificationStatus: string;
  applicantsCount: number;
  employeesCount: number;
};

function parseLocation(
  raw: string | null,
): { city: string; country: string } | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { city?: string; country?: string };
    if (parsed.city || parsed.country) {
      return {
        city: parsed.city ?? '',
        country: parsed.country ?? 'Cameroon',
      };
    }
  } catch {
    const parts = raw.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      return { city: parts[0], country: parts.slice(1).join(', ') };
    }
    return { city: raw, country: 'Cameroon' };
  }
  return { city: raw, country: 'Cameroon' };
}

function serializeLocation(
  loc: { city?: string; country?: string } | null | undefined,
): string | null {
  if (!loc) {
    return null;
  }
  return JSON.stringify({
    city: loc.city ?? '',
    country: loc.country ?? 'Cameroon',
  });
}

@Injectable()
export class EmployerCompanyService {
  constructor(
    private readonly employerContext: EmployerContextService,
    private readonly employerProfilesRepository: EmployerProfilesRepository,
    private readonly filesService: FilesService,
    private readonly prisma: PrismaService,
  ) {}

  async getCompany(authUser: LocalAuthUser): Promise<CompanyProfileEntity> {
    const { user, profile } =
      await this.employerContext.requireEmployerProfile(authUser);
    return this.toCompany(user, profile);
  }

  async updateCompany(
    authUser: LocalAuthUser,
    dto: UpdateCompanyDto,
  ): Promise<CompanyProfileEntity> {
    const { user, profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const updated = await this.employerProfilesRepository.updateByUserId(
      user.id,
      {
        ...(dto.name !== undefined ? { companyName: dto.name } : {}),
        ...(dto.tagline !== undefined ? { tagline: dto.tagline } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.size !== undefined ? { companySize: dto.size } : {}),
        ...(dto.bio !== undefined ? { about: dto.bio } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.logo !== undefined ? { logoUrl: dto.logo } : {}),
        ...(dto.location !== undefined
          ? { location: serializeLocation(dto.location) }
          : {}),
      },
    );

    return this.toCompany(user, updated);
  }

  async uploadLogo(
    authUser: LocalAuthUser,
    file: Express.Multer.File,
  ): Promise<CloudinaryUploadResult & { logoUrl: string }> {
    const { user, profile } =
      await this.employerContext.requireEmployerProfile(authUser);

    const result = await this.filesService.uploadEmployerLogo(file, profile.id);
    await this.employerProfilesRepository.updateByUserId(user.id, {
      logoUrl: result.secureUrl,
    });

    return { ...result, logoUrl: result.secureUrl };
  }

  private async toCompany(
    user: User,
    profile: EmployerProfile,
  ): Promise<CompanyProfileEntity> {
    const [applicantsCount, employeesCount] = await this.prisma.$transaction([
      this.prisma.application.count({
        where: { job: { employerId: profile.id } },
      }),
      this.prisma.workEngagement.count({
        where: {
          employerId: profile.id,
          status: EngagementStatus.ACTIVE,
        },
      }),
    ]);

    return {
      companyId: profile.id,
      name: profile.companyName,
      tagline: profile.tagline,
      logo: profile.logoUrl,
      industry: profile.industry,
      size: profile.companySize,
      bio: profile.about,
      location: parseLocation(profile.location),
      website: profile.website,
      email: user.email,
      verificationStatus: profile.verificationStatus,
      applicantsCount,
      employeesCount,
    };
  }
}
