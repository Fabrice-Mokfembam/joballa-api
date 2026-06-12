import { HttpException, HttpStatus } from '@nestjs/common';

export function throwAccountSuspended(): never {
  throw new HttpException(
    {
      success: false,
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Account suspended. Contact support.',
      },
    },
    HttpStatus.FORBIDDEN,
  );
}
