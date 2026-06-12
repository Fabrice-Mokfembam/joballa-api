import { Injectable } from '@nestjs/common';
import type { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OtpCodesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async invalidateUnused(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    await this.prisma.otpCode.updateMany({
      where: { identifier, purpose, used: false },
      data: { used: true },
    });
  }

  async create(params: {
    identifier: string;
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: Date;
    registrationSnapshot?: object | null;
  }) {
    return this.prisma.otpCode.create({
      data: {
        identifier: params.identifier,
        codeHash: params.codeHash,
        purpose: params.purpose,
        expiresAt: params.expiresAt,
        registrationSnapshot: params.registrationSnapshot ?? undefined,
      },
    });
  }

  async findLatestUnused(identifier: string, purpose: OtpPurpose) {
    return this.prisma.otpCode.findFirst({
      where: { identifier, purpose, used: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.otpCode.update({
      where: { id },
      data: { used: true },
    });
  }

  /** For resend sanity: identifier had at least one OTP row for purpose (used or unused). */
  async hasEverHadOtp(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    const row = await this.prisma.otpCode.findFirst({
      where: { identifier, purpose },
      select: { id: true },
    });
    return !!row;
  }
}
