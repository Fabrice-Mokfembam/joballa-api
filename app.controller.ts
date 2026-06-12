import { Controller, Get, BadRequestException } from '@nestjs/common';
import { PrismaService } from './src/prisma/prisma.service'; // Adjust path if needed

@Controller('test')
export class TestController {
  constructor(private readonly prisma: PrismaService) {}

  // Test 1: Standard NestJS Exception
  @Get('http')
  testHttp() {
    throw new BadRequestException('This is a targeted NestJS error');
  }

  // Test 2: Raw Code Crash (The "Unexpected" Error)
  @Get('crash')
  testCrash() {
    const undefinedUser: any = undefined;
    return undefinedUser.profile.name; // This will trigger a TypeError
  }

  // Test 3: Prisma Unique Constraint (P2002)
  @Get('prisma')
  async testPrisma() {
    // Assuming your 'User' model has a unique 'email' field
    // We try to create two users with the exact same email
    const duplicateEmail = 'test@joballa.com';

    await this.prisma.user.create({
      data: { email: duplicateEmail, clerkId: '123' },
    });
    return await this.prisma.user.create({
      data: { email: duplicateEmail, clerkId: '456' },
    });
  }
}
