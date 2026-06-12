import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** In-memory throttle: max 3 resends per identifier+purpose per rolling hour (per replica). */
@Injectable()
export class OtpResendThrottleService {
  private readonly store = new Map<string, number[]>();
  private static readonly WINDOW_MS = 60 * 60 * 1000;
  private static readonly MAX = 3;

  assertAllowed(key: string): void {
    const now = Date.now();
    const windowStart = now - OtpResendThrottleService.WINDOW_MS;
    const stamps = this.store.get(key)?.filter((t) => t > windowStart) ?? [];

    if (stamps.length >= OtpResendThrottleService.MAX) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    stamps.push(now);
    this.store.set(key, stamps);
  }
}
