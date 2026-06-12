import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Pool } from 'pg';
import {
  createPgPool,
  resolveRuntimeDatabaseUrl,
} from './database-connection.util';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = resolveRuntimeDatabaseUrl();
    const pool = createPgPool(connectionString);
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;

    const host = (() => {
      try {
        return new URL(connectionString).hostname;
      } catch {
        return '(unknown)';
      }
    })();
    this.logger.log(`Prisma using PostgreSQL host: ${host}`);
  }

  async onModuleInit() {
    this.logger.log('Connecting to PostgreSQL database...');
    await this.$connect();
    this.logger.log('Database connection established successfully.');
  }

  async onModuleDestroy() {
    this.logger.log('Closing database connection...');
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database connection closed.');
  }
}
