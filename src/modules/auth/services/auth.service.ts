import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { throwAccountSuspended } from '../../../common/errors/account-suspended.error';
import {
  AccountStatus,
  OtpPurpose,
  PreferredLanguage,
  Prisma,
  Role,
  VerificationStatus,
  type User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  OTP_BCRYPT_ROUNDS,
  PASSWORD_BCRYPT_ROUNDS,
  REFRESH_TOKEN_COOKIE,
} from '../auth.constants';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto';
import type { LoginDto } from '../dto/login.dto';
import type { RefreshSessionDto } from '../dto/refresh-session.dto';
import type { RegisterDto } from '../dto/register.dto';
import type { ResendOtpDto } from '../dto/resend-otp.dto';
import type { ResetPasswordDto } from '../dto/reset-password.dto';
import type { GoogleAuthDto } from '../dto/google-auth.dto';
import type { VerifyRegistrationDto } from '../dto/verify-registration.dto';
import { OtpCodesRepository } from '../repositories/otp-codes.repository';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { accessTokenExpiresSeconds } from '../utils/jwt-ttl';
import { digestOpaqueToken } from '../utils/refresh-token-digest';
import {
  canonicalIdentifierFromUnknown,
  looksLikeEmail,
} from '../utils/identifier.util';
import { AuthMessagingService } from './auth-messaging.service';
import { GoogleTokenService } from './google-token.service';
import { OtpResendThrottleService } from './otp-resend-throttle.service';

type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'worker' | 'employer';
  preferredLanguage: 'eng' | 'fre';
  accountStatus: 'active' | 'suspended' | 'deactivated';
  profilePhotoUrl: string | null;
  workerProfileId: string | null;
  employerProfileId: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly otpCodesRepository: OtpCodesRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly messagingService: AuthMessagingService,
    private readonly resendThrottleService: OtpResendThrottleService,
    private readonly googleTokenService: GoogleTokenService,
  ) {}

  async googleAuth(dto: GoogleAuthDto, res: Response) {
    const googleUser = await this.googleTokenService.verifyIdToken(dto.idToken);
    const mode = dto.mode.toLowerCase() as 'signup' | 'signin';

    if (mode === 'signup') {
      if (!dto.role) {
        throw new BadRequestException('role is required when mode is signup.');
      }
      const requestedRole = parseRole(dto.role);
      const preferredLanguage = parsePreferredLanguage(dto.preferredLanguage);
      const { user, isNewUser } = await this.googleSignup(
        googleUser,
        requestedRole,
        preferredLanguage,
      );
      this.assertAccountActive(user);
      const fresh = await this.findUserWithProfilesOrThrow(user.id);
      const session = await this.finalizeSession(fresh, res);
      return { ...session, isNewUser };
    }

    const user = await this.googleSignin(googleUser);
    this.assertAccountActive(user);
    await this.ensureRoleProfile(user.id, user.role);
    const fresh = await this.findUserWithProfilesOrThrow(user.id);
    const session = await this.finalizeSession(fresh, res);
    return { ...session, isNewUser: false };
  }

  async registerSendOtp(dto: RegisterDto) {
    const { canonical, isEmail } = this.normalizeRegisterContact(dto);
    const role = parseRole(dto.role);
    const preferredLanguage = parsePreferredLanguage(dto.preferredLanguage);

    const exists = await this.prisma.user.findFirst({
      where: isEmail ? { email: canonical } : { phone: canonical },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException(
        'An account with this identifier already exists.',
      );
    }

    await this.otpCodesRepository.invalidateUnused(
      canonical,
      OtpPurpose.REGISTRATION,
    );

    const otp = this.generateOtpDigits();
    const expiresAt = new Date(Date.now() + this.otpExpireMinutes() * 60_000);
    await this.otpCodesRepository.create({
      identifier: canonical,
      purpose: OtpPurpose.REGISTRATION,
      codeHash: await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS),
      expiresAt,
      registrationSnapshot: {
        role,
        preferredLanguage,
        email: isEmail ? canonical : null,
        phone: isEmail ? null : canonical,
        passwordHash: await bcrypt.hash(dto.password, PASSWORD_BCRYPT_ROUNDS),
      },
    });

    await this.messagingService.sendOtp(
      canonical,
      otp,
      this.otpExpireMinutes(),
      {
        purpose: OtpPurpose.REGISTRATION,
        language: preferredLanguage,
      },
    );

    return {
      identifier: canonical,
      deliveryChannel: isEmail ? 'email' : 'sms',
      otpExpiresAt: expiresAt.toISOString(),
      message: 'Verification code sent.',
    };
  }

  async verifyRegistration(dto: VerifyRegistrationDto, res: Response) {
    const canonical = canonicalIdentifierFromUnknown(dto.identifier);
    const code = dto.code ?? dto.otp;
    if (!code) {
      throw new BadRequestException('Verification code is required.');
    }

    const row = await this.otpCodesRepository.findLatestUnused(
      canonical,
      OtpPurpose.REGISTRATION,
    );
    if (!row || row.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    const ok = await bcrypt.compare(code, row.codeHash);
    if (!ok) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    const snap = parseRegistrationSnapshot(row.registrationSnapshot);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.update({ where: { id: row.id }, data: { used: true } });
      const created = await tx.user.create({
        data: {
          email: snap.email,
          phone: snap.phone,
          passwordHash: snap.passwordHash,
          role: snap.role,
          preferredLanguage: snap.preferredLanguage,
          accountStatus: AccountStatus.ACTIVE,
          ...(snap.role === Role.WORKER
            ? {
                workerProfile: {
                  create: {
                    verificationStatus: VerificationStatus.NOT_SUBMITTED,
                    languages: [],
                    skills: [],
                    preferredJobCategories: [],
                    preferredJobTypes: [],
                  },
                },
              }
            : {
                employerProfile: {
                  create: {
                    companyName:
                      snap.email?.split('@')[0] ?? snap.phone ?? 'Employer',
                    contactPersonName:
                      snap.email?.split('@')[0] ??
                      snap.phone ??
                      'Employer contact',
                    contactEmail: snap.email,
                    contactPhone: snap.phone,
                    verificationStatus: VerificationStatus.NOT_SUBMITTED,
                  },
                },
              }),
        },
        include: {
          workerProfile: { select: { id: true } },
          employerProfile: { select: { id: true } },
        },
      });
      return created;
    });

    return this.finalizeSession(user, res);
  }

  async login(dto: LoginDto, res: Response) {
    const canonical = canonicalIdentifierFromUnknown(dto.identifier);
    const isEmail = looksLikeEmail(canonical);
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: canonical } : { phone: canonical },
      include: {
        workerProfile: { select: { id: true } },
        employerProfile: { select: { id: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!user.passwordHash) {
      if (user.googleId) {
        throw new UnauthorizedException(
          'This account uses Google Sign-In. Continue with Google instead.',
        );
      }
      throw new UnauthorizedException('Invalid credentials.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throwAccountSuspended();
    }
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('This account is not active.');
    }

    await this.ensureRoleProfile(user.id, user.role);
    const fresh = await this.findUserWithProfilesOrThrow(user.id);
    return this.finalizeSession(fresh, res);
  }

  async refreshTokens(req: Request, res: Response, body?: RefreshSessionDto) {
    const raw = this.extractRefreshTokenRaw(req, body);
    if (!raw) {
      throw new UnauthorizedException('No refresh token provided.');
    }

    const row = await this.refreshTokensRepository.findActiveByDigest(
      digestOpaqueToken(raw),
    );
    if (!row?.user || row.expiresAt <= new Date()) {
      if (row) await this.refreshTokensRepository.deleteById(row.id);
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const ok = await this.refreshTokensRepository.validateRowMatchesPlain(
      row,
      raw,
    );
    if (!ok) {
      this.logger.warn('Refresh token bcrypt mismatch.');
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (row.user.accountStatus === AccountStatus.SUSPENDED) {
      throwAccountSuspended();
    }
    if (row.user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active.');
    }

    await this.refreshTokensRepository.deleteById(row.id);
    const user = await this.findUserWithProfilesOrThrow(row.userId);
    return this.finalizeSession(user, res);
  }

  async logout(req: Request, res: Response, userId?: string) {
    const raw = this.extractRefreshTokenRaw(req);
    if (raw) {
      const row = await this.refreshTokensRepository.findActiveByDigest(
        digestOpaqueToken(raw),
      );
      if (row) await this.refreshTokensRepository.deleteById(row.id);
    }
    if (userId) {
      await this.prisma.pushToken.deleteMany({ where: { userId } });
    }
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const canonical = canonicalIdentifierFromUnknown(dto.identifier);
    const isEmail = looksLikeEmail(canonical);
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: canonical } : { phone: canonical },
    });
    let expiresAt: Date | undefined;

    if (user) {
      await this.otpCodesRepository.invalidateUnused(
        canonical,
        OtpPurpose.PASSWORD_RESET,
      );
      const otp = this.generateOtpDigits();
      expiresAt = new Date(Date.now() + this.otpExpireMinutes() * 60_000);
      await this.otpCodesRepository.create({
        identifier: canonical,
        purpose: OtpPurpose.PASSWORD_RESET,
        codeHash: await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS),
        expiresAt,
      });
      await this.messagingService.sendOtp(
        canonical,
        otp,
        this.otpExpireMinutes(),
        {
          purpose: OtpPurpose.PASSWORD_RESET,
          language: user.preferredLanguage,
        },
      );
    }

    return {
      message: 'If an account exists, a reset code has been sent.',
      deliveryChannel: isEmail ? 'email' : 'sms',
      ...(expiresAt ? { otpExpiresAt: expiresAt.toISOString() } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const canonical = canonicalIdentifierFromUnknown(dto.identifier);
    const code = dto.code ?? dto.otp;
    if (!code) {
      throw new BadRequestException('Reset code is required.');
    }

    const row = await this.otpCodesRepository.findLatestUnused(
      canonical,
      OtpPurpose.PASSWORD_RESET,
    );
    if (!row || row.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset code.');
    }

    const ok = await bcrypt.compare(code, row.codeHash);
    if (!ok) {
      throw new BadRequestException('Invalid or expired reset code.');
    }

    const isEmail = looksLikeEmail(canonical);
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: canonical } : { phone: canonical },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired reset code.');
    }

    await this.otpCodesRepository.markUsed(row.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(
          dto.newPassword,
          PASSWORD_BCRYPT_ROUNDS,
        ),
      },
    });
    await this.refreshTokensRepository.deleteAllForUser(user.id);
    return { message: 'Password updated' };
  }

  async resendOtp(dto: ResendOtpDto) {
    const canonical = canonicalIdentifierFromUnknown(dto.identifier);
    const purpose = parseOtpPurpose(dto.purpose);
    this.resendThrottleService.assertAllowed(`${purpose}:${canonical}`);

    const old = await this.prisma.otpCode.findFirst({
      where: { identifier: canonical, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (!old) {
      throw new BadRequestException('No OTP flow found for this identifier.');
    }

    await this.otpCodesRepository.invalidateUnused(canonical, purpose);
    const otp = this.generateOtpDigits();
    const expiresAt = new Date(Date.now() + this.otpExpireMinutes() * 60_000);
    await this.otpCodesRepository.create({
      identifier: canonical,
      purpose,
      codeHash: await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS),
      expiresAt,
      registrationSnapshot:
        purpose === OtpPurpose.REGISTRATION
          ? (old.registrationSnapshot as object | null)
          : undefined,
    });

    const lang =
      purpose === OtpPurpose.REGISTRATION
        ? parseRegistrationSnapshot(old.registrationSnapshot).preferredLanguage
        : PreferredLanguage.ENG;

    await this.messagingService.sendOtp(
      canonical,
      otp,
      this.otpExpireMinutes(),
      {
        purpose,
        language: lang,
      },
    );

    return {
      message: 'Verification code sent.',
      otpExpiresAt: expiresAt.toISOString(),
    };
  }

  async getMe(userId: string) {
    const user = await this.findUserWithProfilesOrThrow(userId);
    return { user: this.toSessionUser(user) };
  }

  async selectRole(userId: string) {
    return this.getMe(userId);
  }

  private async googleSignup(
    googleUser: {
      sub: string;
      email: string;
      name: string | null;
      picture: string | null;
    },
    role: Role,
    preferredLanguage: PreferredLanguage,
  ) {
    const byGoogle = await this.prisma.user.findUnique({
      where: { googleId: googleUser.sub },
      include: {
        workerProfile: { select: { id: true } },
        employerProfile: { select: { id: true } },
      },
    });
    if (byGoogle) {
      if (byGoogle.role !== role) {
        throw new ConflictException(
          `This Google account is registered as ${byGoogle.role === Role.WORKER ? 'a worker' : 'an employer'}. Sign in instead or use a different Google account.`,
        );
      }
      return { user: byGoogle, isNewUser: false };
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
      include: {
        workerProfile: { select: { id: true } },
        employerProfile: { select: { id: true } },
      },
    });
    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== googleUser.sub) {
        throw new ConflictException(
          'This email is linked to a different Google account.',
        );
      }
      if (!byEmail.googleId) {
        throw new ConflictException(
          'An account with this email already exists. Sign in with your password, or use Google Sign-In from the sign-in page to link your account.',
        );
      }
      if (byEmail.role !== role) {
        throw new ConflictException(
          `This email is registered as ${byEmail.role === Role.WORKER ? 'a worker' : 'an employer'}. Choose the correct role or sign in instead.`,
        );
      }
      return { user: byEmail, isNewUser: false };
    }

    const created = await this.createPlatformUser({
      email: googleUser.email,
      phone: null,
      passwordHash: null,
      googleId: googleUser.sub,
      role,
      preferredLanguage,
      photoUrl: googleUser.picture,
      displayName: googleUser.name,
    });
    return { user: created, isNewUser: true };
  }

  private async googleSignin(googleUser: {
    sub: string;
    email: string;
    name: string | null;
    picture: string | null;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleUser.sub },
      include: {
        workerProfile: { select: { id: true } },
        employerProfile: { select: { id: true } },
      },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: googleUser.email },
        include: {
          workerProfile: { select: { id: true } },
          employerProfile: { select: { id: true } },
        },
      });
      if (user && !user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.sub,
            photoUrl: user.photoUrl ?? googleUser.picture,
          },
          include: {
            workerProfile: { select: { id: true } },
            employerProfile: { select: { id: true } },
          },
        });
      }
    }

    if (!user) {
      throw new NotFoundException(
        'No account found for this Google account. Sign up first.',
      );
    }

    if (!user.googleId) {
      throw new ConflictException(
        'This account uses a password. Sign in with email or phone and password.',
      );
    }

    if (!user.photoUrl && googleUser.picture) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { photoUrl: googleUser.picture },
        include: {
          workerProfile: { select: { id: true } },
          employerProfile: { select: { id: true } },
        },
      });
    }

    return user;
  }

  private async createPlatformUser(input: {
    email: string | null;
    phone: string | null;
    passwordHash: string | null;
    googleId: string | null;
    role: Role;
    preferredLanguage: PreferredLanguage;
    photoUrl: string | null;
    displayName: string | null;
  }) {
    const displayName =
      input.displayName?.trim() ||
      input.email?.split('@')[0] ||
      input.phone ||
      'Joballa user';

    return this.prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        googleId: input.googleId,
        photoUrl: input.photoUrl,
        role: input.role,
        preferredLanguage: input.preferredLanguage,
        accountStatus: AccountStatus.ACTIVE,
        ...(input.role === Role.WORKER
          ? {
              workerProfile: {
                create: {
                  fullName: displayName,
                  verificationStatus: VerificationStatus.NOT_SUBMITTED,
                  languages: [],
                  skills: [],
                  preferredJobCategories: [],
                  preferredJobTypes: [],
                },
              },
            }
          : {
              employerProfile: {
                create: {
                  companyName: displayName,
                  contactPersonName: displayName,
                  contactEmail: input.email,
                  contactPhone: input.phone,
                  verificationStatus: VerificationStatus.NOT_SUBMITTED,
                },
              },
            }),
      },
      include: {
        workerProfile: { select: { id: true } },
        employerProfile: { select: { id: true } },
      },
    });
  }

  private assertAccountActive(user: User) {
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throwAccountSuspended();
    }
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('This account is not active.');
    }
  }

  private normalizeRegisterContact(dto: RegisterDto) {
    const hasEmail = !!dto.email?.trim();
    const hasPhone = !!dto.phone?.trim();
    if (hasEmail === hasPhone) {
      throw new BadRequestException('Provide exactly one of email or phone.');
    }
    const canonical = hasEmail
      ? dto.email!.trim().toLowerCase()
      : dto.phone!.replace(/\s+/g, '').trim();
    return { canonical, isEmail: hasEmail };
  }

  private async ensureRoleProfile(userId: string, role: Role) {
    if (role === Role.WORKER) {
      await this.prisma.workerProfile.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          languages: [],
          skills: [],
          preferredJobCategories: [],
          preferredJobTypes: [],
        },
      });
      return;
    }
    await this.prisma.employerProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        companyName: 'Employer',
        contactPersonName: 'Employer contact',
      },
    });
  }

  private async finalizeSession(
    user: User & {
      workerProfile?: { id: string } | null;
      employerProfile?: { id: string } | null;
    },
    res: Response,
  ) {
    await this.refreshTokensRepository.deleteExpiredForUser(user.id);
    const { plainToken } = await this.refreshTokensRepository.createForUser(
      user.id,
      this.config,
    );
    this.setRefreshCookie(res, plainToken);
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: plainToken,
      user: this.toSessionUser(user),
    };
  }

  private async signAccessToken(user: User) {
    return this.jwtService.signAsync(
      { sub: user.id, role: user.role, email: user.email ?? '' },
      { expiresIn: accessTokenExpiresSeconds(this.config) },
    );
  }

  private async findUserWithProfilesOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workerProfile: { select: { id: true } },
        employerProfile: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private toSessionUser(
    user: User & {
      workerProfile?: { id: string } | null;
      employerProfile?: { id: string } | null;
    },
  ): SessionUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role === Role.WORKER ? 'worker' : 'employer',
      preferredLanguage:
        user.preferredLanguage === PreferredLanguage.FRE ? 'fre' : 'eng',
      accountStatus: accountStatusToApi(user.accountStatus),
      profilePhotoUrl: user.photoUrl,
      workerProfileId: user.workerProfile?.id ?? null,
      employerProfileId: user.employerProfile?.id ?? null,
    };
  }

  private otpExpireMinutes(): number {
    const n = Number.parseInt(
      this.config.get<string>('OTP_EXPIRES_MINUTES') ?? '10',
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  private generateOtpDigits(): string {
    const fixed = this.config.get<string>('JOBALLA_DEV_FIXED_OTP')?.trim();
    if (
      process.env.NODE_ENV !== 'production' &&
      fixed &&
      /^[0-9]{6}$/.test(fixed)
    ) {
      return fixed;
    }
    return randomInt(100_000, 1_000_000).toString();
  }

  private extractRefreshTokenRaw(req: Request, body?: RefreshSessionDto) {
    return (
      body?.refreshToken?.trim() ||
      (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined)?.trim()
    );
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production' ||
        this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite:
        (this.config.get<string>('COOKIE_SAME_SITE') as
          | 'lax'
          | 'strict'
          | 'none') || 'lax',
      path: this.config.get<string>('COOKIE_PATH') || '/',
      maxAge: this.refreshTokensRepository.refreshTtlMs(this.config),
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: this.config.get<string>('COOKIE_PATH') || '/',
    });
  }
}

function parseRole(raw: string): Role {
  const v = raw.toLowerCase();
  if (v === 'worker') return Role.WORKER;
  if (v === 'employer') return Role.EMPLOYER;
  throw new BadRequestException('Invalid role.');
}

function parsePreferredLanguage(raw?: string): PreferredLanguage {
  const v = (raw ?? 'eng').toLowerCase();
  if (v === 'fre' || v === 'fr') return PreferredLanguage.FRE;
  return PreferredLanguage.ENG;
}

function parseOtpPurpose(raw: string): OtpPurpose {
  const v = raw.toLowerCase();
  if (v === 'registration') return OtpPurpose.REGISTRATION;
  if (v === 'password_reset') return OtpPurpose.PASSWORD_RESET;
  throw new BadRequestException('Invalid OTP purpose.');
}

function parseRegistrationSnapshot(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Registration metadata is missing.');
  }
  const snap = value as Record<string, unknown>;
  return {
    role: parseRole(String(snap.role)),
    preferredLanguage: parsePreferredLanguage(
      String(snap.preferredLanguage ?? 'eng'),
    ),
    email: typeof snap.email === 'string' ? snap.email : null,
    phone: typeof snap.phone === 'string' ? snap.phone : null,
    passwordHash: String(snap.passwordHash ?? ''),
  };
}

function accountStatusToApi(status: AccountStatus) {
  if (status === AccountStatus.SUSPENDED) return 'suspended';
  if (status === AccountStatus.DEACTIVATED) return 'deactivated';
  return 'active';
}
