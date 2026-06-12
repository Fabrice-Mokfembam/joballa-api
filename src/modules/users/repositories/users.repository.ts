import { Injectable } from '@nestjs/common';
import type { Language, Role, User } from '@prisma/client';
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateUserInput {
  email?: string | null;
  phone?: string | null;
  passwordHash: string;
  role: Role;
  languagePreference: Language;
  verificationStatus?: VerificationStatus;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  findByLoginIdentifier(
    canonical: string,
    isEmailIdentifier: boolean,
  ): Promise<User | null> {
    if (!canonical) {
      return Promise.resolve(null);
    }
    return isEmailIdentifier
      ? this.findByEmail(canonical)
      : this.findByPhone(canonical);
  }

  async findVerifiedByCanonical(
    canonical: string,
    isEmailIdentifier: boolean,
  ): Promise<User | null> {
    if (!canonical) {
      return null;
    }

    const user = isEmailIdentifier
      ? await this.findByEmail(canonical)
      : await this.findByPhone(canonical);

    return user?.verificationStatus === VerificationStatus.VERIFIED
      ? user
      : null;
  }

  /** Block registration if identifier already belongs to a verified account. */
  async hasVerifiedUserForContact(params: {
    email: string | null;
    phone: string | null;
  }): Promise<boolean> {
    const orFilter = [] as Array<{ email: string } | { phone: string }>;
    if (params.email) {
      orFilter.push({ email: params.email });
    }
    if (params.phone) {
      orFilter.push({ phone: params.phone });
    }
    if (orFilter.length === 0) {
      return false;
    }

    const found = await this.prisma.user.findFirst({
      where: {
        verificationStatus: VerificationStatus.VERIFIED,
        OR: orFilter,
      },
      select: { id: true },
    });
    return !!found;
  }

  /** True if any user row uses this email or phone (`@@unique` applies to all rows). */
  async hasUserForContact(params: {
    email: string | null;
    phone: string | null;
  }): Promise<boolean> {
    const orFilter = [] as Array<{ email: string } | { phone: string }>;
    if (params.email) {
      orFilter.push({ email: params.email });
    }
    if (params.phone) {
      orFilter.push({ phone: params.phone });
    }
    if (orFilter.length === 0) {
      return false;
    }

    const found = await this.prisma.user.findFirst({
      where: { OR: orFilter },
      select: { id: true },
    });
    return !!found;
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email ?? null,
        phone: input.phone ?? null,
        passwordHash: input.passwordHash,
        role: input.role,
        languagePreference: input.languagePreference,
        verificationStatus:
          input.verificationStatus ?? VerificationStatus.VERIFIED,
      },
    });
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
