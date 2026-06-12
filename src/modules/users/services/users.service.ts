import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { CreateUserInput } from '../repositories/users.repository';
import { UsersRepository } from '../repositories/users.repository';
import {
  toUserSummaryEntity,
  type UserSummaryEntity,
} from '../entities/user-summary.entity';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  findByLoginIdentifier(
    canonical: string,
    isEmailIdentifier: boolean,
  ): Promise<User | null> {
    return this.usersRepository.findByLoginIdentifier(
      canonical,
      isEmailIdentifier,
    );
  }

  findVerifiedByCanonical(
    canonical: string,
    isEmailIdentifier: boolean,
  ): Promise<User | null> {
    return this.usersRepository.findVerifiedByCanonical(
      canonical,
      isEmailIdentifier,
    );
  }

  hasVerifiedUserForContact(params: {
    email: string | null;
    phone: string | null;
  }): Promise<boolean> {
    return this.usersRepository.hasVerifiedUserForContact(params);
  }

  hasUserForContact(params: {
    email: string | null;
    phone: string | null;
  }): Promise<boolean> {
    return this.usersRepository.hasUserForContact(params);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  createUser(params: CreateUserInput): Promise<User> {
    return this.usersRepository.create(params);
  }

  updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
    return this.usersRepository.updatePasswordHash(userId, passwordHash);
  }

  toSummary(user: User): UserSummaryEntity {
    return toUserSummaryEntity(user);
  }
}
