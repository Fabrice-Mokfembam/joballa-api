import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export type VerifiedGoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

@Injectable()
export class GoogleTokenService {
  private readonly client: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client();
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const audiences = this.allowedAudiences();
    if (!audiences.length) {
      throw new BadRequestException(
        'Google Sign-In is not configured on the server.',
      );
    }

    let lastError: unknown;
    for (const audience of audiences) {
      try {
        const ticket = await this.client.verifyIdToken({ idToken, audience });
        const payload = ticket.getPayload();
        if (!payload?.sub) {
          throw new BadRequestException('Invalid Google token.');
        }
        if (!payload.email) {
          throw new BadRequestException(
            'Google account must include a verified email.',
          );
        }
        if (payload.email_verified !== true) {
          throw new BadRequestException(
            'Google email address is not verified.',
          );
        }
        return {
          sub: payload.sub,
          email: payload.email.trim().toLowerCase(),
          emailVerified: true,
          name: payload.name?.trim() || null,
          picture: payload.picture?.trim() || null,
        };
      } catch (err) {
        lastError = err;
        if (err instanceof BadRequestException) throw err;
      }
    }

    throw new BadRequestException(
      lastError instanceof Error
        ? `Invalid Google token: ${lastError.message}`
        : 'Invalid Google token.',
    );
  }

  private allowedAudiences(): string[] {
    const combined = [
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_CLIENT_IDS'),
    ]
      .filter(Boolean)
      .join(',');

    return combined
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
}
