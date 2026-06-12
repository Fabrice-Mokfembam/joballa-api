import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { REFRESH_TOKEN_BCRYPT_ROUNDS } from '../auth.constants';
import { digestOpaqueToken } from '../utils/refresh-token-digest';
import { refreshTokenExpiresSeconds } from '../utils/jwt-ttl';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  refreshTtlMs(config: ConfigService): number {
    return refreshTokenExpiresSeconds(config) * 1000;
  }

  async deleteExpiredForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lte: new Date() },
      },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { id } });
  }

  /** Issue new opaque refresh token; persists digest + bcrypt hash of raw token. */
  async createForUser(
    userId: string,
    config: ConfigService,
  ): Promise<{
    plainToken: string;
    expiresAt: Date;
    rowId: string;
  }> {
    const plainToken = randomUUID();
    const ttlSec = refreshTokenExpiresSeconds(config);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    const lookupDigest = digestOpaqueToken(plainToken);
    const tokenHash = await bcrypt.hash(
      plainToken,
      REFRESH_TOKEN_BCRYPT_ROUNDS,
    );

    const row = await this.prisma.refreshToken.create({
      data: {
        userId,
        lookupDigest,
        tokenHash,
        expiresAt,
      },
    });

    return { plainToken, expiresAt, rowId: row.id };
  }

  async findActiveByDigest(lookupDigest: string) {
    return this.prisma.refreshToken.findUnique({
      where: { lookupDigest },
      include: { user: true },
    });
  }

  /** Optional: revoke token matched by bcrypt after digest hit (belt-and-suspenders). */
  async validateRowMatchesPlain(
    row: { tokenHash: string },
    plainCookie: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainCookie, row.tokenHash);
  }
}
