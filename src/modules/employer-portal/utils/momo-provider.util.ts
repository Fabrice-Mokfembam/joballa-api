import { MomoProvider } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export function parseMomoProvider(value: string): MomoProvider {
  const key = value.trim().toLowerCase();
  if (key === 'momo' || key === 'mtn' || key === 'mtn_momo') {
    return MomoProvider.MTN_MOMO;
  }
  if (key === 'om' || key === 'orange' || key === 'orange_money') {
    return MomoProvider.ORANGE_MONEY;
  }
  if (value === MomoProvider.MTN_MOMO || value === MomoProvider.ORANGE_MONEY) {
    return value;
  }
  throw new BadRequestException('provider must be MoMo or OM');
}

export function momoProviderToApi(provider: MomoProvider): string {
  return provider === MomoProvider.MTN_MOMO ? 'MoMo' : 'OM';
}
