import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EmployerProfile } from '@prisma/client';
import { UpdateEmployerProfileDto } from '../dto/update-employer-profile.dto';
import type { EmployerProfileResponseEntity } from '../entities/employer-profile-response.entity';
import { toEmployerProfileResponseEntity } from '../entities/employer-profile-response.entity';
import { EmployerProfilesRepository } from '../repositories/employer-profiles.repository';

@Injectable()
export class EmployerProfilesService {
  constructor(
    private readonly employerProfilesRepository: EmployerProfilesRepository,
  ) {}

  async ensureForUser(
    userId: string,
    companyName: string,
  ): Promise<EmployerProfile> {
    const existingProfile =
      await this.employerProfilesRepository.findByUserId(userId);

    if (existingProfile) {
      return existingProfile;
    }

    return this.employerProfilesRepository.createForUser(userId, companyName);
  }

  async getMe(userId: string): Promise<EmployerProfileResponseEntity> {
    const profile = await this.employerProfilesRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException('Employer profile not found for this user.');
    }

    return this.toResponse(profile);
  }

  async updateMe(
    userId: string,
    dto: UpdateEmployerProfileDto,
  ): Promise<EmployerProfileResponseEntity> {
    const profile = await this.employerProfilesRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException('Employer profile not found for this user.');
    }

    const data: Prisma.EmployerProfileUpdateInput = {};

    if (dto.companyName !== undefined) {
      data.companyName = dto.companyName;
    }

    if (dto.industry !== undefined) {
      data.industry = dto.industry;
    }

    if (dto.location !== undefined) {
      data.location = dto.location;
    }

    if (dto.logoUrl !== undefined) {
      data.logoUrl = dto.logoUrl;
    }

    if (dto.website !== undefined) {
      data.website = dto.website;
    }

    if (dto.about !== undefined) {
      data.about = dto.about;
    }

    if (dto.businessRegDocUrl !== undefined) {
      data.businessRegDocUrl = dto.businessRegDocUrl;
    }

    if (dto.paymentProvider !== undefined) {
      data.paymentProvider = dto.paymentProvider;
    }

    if (dto.paymentAccount !== undefined) {
      data.paymentAccount = dto.paymentAccount;
    }

    const updatedProfile = await this.employerProfilesRepository.updateByUserId(
      userId,
      data,
    );

    return this.toResponse(updatedProfile);
  }

  toResponse(profile: EmployerProfile): EmployerProfileResponseEntity {
    return toEmployerProfileResponseEntity(profile);
  }
}
