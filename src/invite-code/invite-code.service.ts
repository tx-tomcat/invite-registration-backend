/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InviteCode } from './entities/invite-code.entity';
import { CodeUsage } from './entities/code-usage.entity';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { nanoid } from 'nanoid';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { CreateInviteDto } from './dto/create-invite-code.dto';
import { UseInviteDto } from './dto/use-invite.dto';
import { Registration } from './entities/registration.entity';
import { ethers } from 'ethers';

@Injectable()
export class InviteCodeService {
  private rateLimiter: RateLimiterRedis;
  private readonly EMAIL_CACHE_PREFIX = 'email:';
  private readonly WALLET_CACHE_PREFIX = 'wallet:';
  private readonly CACHE_TTL = 3600;
  private readonly INVITE_CACHE_PREFIX = 'invite:';
  constructor(
    @InjectRepository(InviteCode)
    private inviteRepository: Repository<InviteCode>,
    @InjectRepository(Registration)
    private registrationRepository: Repository<Registration>,
    private dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'invite_limiter',
      points: 5, // Number of attempts
      duration: 60, // Per minute
    });
  }

  private async generateUniqueCode(): Promise<string> {
    // Custom alphabet excluding similar looking characters
    let code: string;
    let isUnique = false;

    while (!isUnique) {
      code = await nanoid(8);
      const existing = await this.inviteRepository.findOne({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
    }

    return code;
  }

  async createInviteCode(dto: CreateInviteDto): Promise<InviteCode> {
    try {
      await this.rateLimiter.consume(dto.creatorEmail);
    } catch (error: any) {
      throw new ConflictException('Too many code generation attempts');
    }

    const code = await this.generateUniqueCode();
    const invite = this.inviteRepository.create({
      code,
      creatorEmail: dto.creatorEmail,
      maxUses: dto.maxUses,
    });

    return this.inviteRepository.save(invite);
  }

  async useInviteCode(
    dto: UseInviteDto,
    ipAddress: string,
    deviceInfo: any,
  ): Promise<CodeUsage> {
    return await this.dataSource.transaction(async (manager) => {
      const inviteCode = await manager
        .createQueryBuilder(InviteCode, 'invite')
        .setLock('pessimistic_write')
        .where('invite.code = :code', { code: dto.code })
        .getOne();

      if (!inviteCode) {
        throw new NotFoundException('Invalid invite code');
      }

      if (!inviteCode.isActive) {
        throw new ConflictException('Code is inactive');
      }

      if (inviteCode.currentUses >= inviteCode.maxUses) {
        throw new ConflictException('Code has reached maximum uses');
      }

      const existingUsage = await manager.findOne(CodeUsage, {
        where: { userEmail: dto.userEmail },
      });

      if (existingUsage) {
        throw new ConflictException('Email has already used an invite code');
      }

      const usage = manager.create(CodeUsage, {
        userEmail: dto.userEmail,
        inviteCode,
        ipAddress,
        deviceInfo,
      });

      inviteCode.currentUses += 1;
      await manager.save(inviteCode);

      return manager.save(usage);
    });
  }

  async getInviteCodeStats(code: string): Promise<{
    usageCount: number;
    remainingUses: number;
    usages: CodeUsage[];
  }> {
    const inviteCode = await this.inviteRepository.findOne({
      where: { code },
      relations: ['usages'],
    });

    if (!inviteCode) {
      throw new NotFoundException('Invalid invite code');
    }

    return {
      usageCount: inviteCode.currentUses,
      remainingUses: inviteCode.maxUses - inviteCode.currentUses,
      usages: inviteCode.usages,
    };
  }

  async verifyInviteCode(code: string): Promise<boolean> {
    const cachedResult = await this.redis.get(
      `${this.INVITE_CACHE_PREFIX}${code}`,
    );
    if (cachedResult) {
      return JSON.parse(cachedResult).isValid;
    }
    const invite = await this.inviteRepository.findOne({
      where: { code, isActive: true },
    });

    const isValid = invite && invite.currentUses < invite.maxUses;

    await this.redis.set(
      `${this.INVITE_CACHE_PREFIX}${code}`,
      JSON.stringify({ isValid, invite }),
      'EX',
      3600,
    );

    return isValid;
  }

  async isEmailUsed(email: string): Promise<boolean> {
    const cachedResult = await this.redis.get(
      `${this.EMAIL_CACHE_PREFIX}${email}`,
    );
    if (cachedResult !== null) {
      return cachedResult === 'true';
    }

    const registration = await this.registrationRepository.findOne({
      where: { email },
    });
    const isUsed = !!registration;

    await this.redis.set(
      `${this.EMAIL_CACHE_PREFIX}${email}`,
      isUsed.toString(),
      'EX',
      this.CACHE_TTL,
    );

    return isUsed;
  }

  async isWalletUsed(walletAddress: string): Promise<boolean> {
    const cachedResult = await this.redis.get(
      `${this.WALLET_CACHE_PREFIX}${walletAddress}`,
    );
    if (cachedResult !== null) {
      return cachedResult === 'true';
    }

    const registration = await this.registrationRepository.findOne({
      where: { walletAddress },
    });
    const isUsed = !!registration;

    await this.redis.set(
      `${this.WALLET_CACHE_PREFIX}${walletAddress}`,
      isUsed.toString(),
      'EX',
      this.CACHE_TTL,
    );

    return isUsed;
  }

  async reserveInvite(payload: {
    code: string;
    email: string;
    walletAddress: string;
    signature: string;
  }): Promise<void> {
    try {
      await this.rateLimiter.consume(payload.email);
    } catch (error) {
      throw new HttpException(
        'Too many attempts, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return await this.dataSource.transaction(async (manager) => {
      const cachedInvite = await this.redis.get(`invite:${payload.code}`);
      let invite;

      if (cachedInvite) {
        invite = JSON.parse(cachedInvite);
      } else {
        invite = await manager.findOne(InviteCode, {
          where: { code: payload.code, isActive: true },
          lock: { mode: 'pessimistic_write' },
        });
      }

      if (!invite || invite.currentUses >= invite.maxUses) {
        throw new HttpException(
          'Invalid or expired invite code',
          HttpStatus.BAD_REQUEST,
        );
      }

      const [emailUsed, walletUsed] = await Promise.all([
        this.isEmailUsed(payload.email),
        this.isWalletUsed(payload.walletAddress),
      ]);

      if (emailUsed) {
        throw new HttpException(
          'Email already registered',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (walletUsed) {
        throw new HttpException(
          'Wallet already registered',
          HttpStatus.BAD_REQUEST,
        );
      }

      try {
        const message = `Register with invite code: ${payload.code}`;
        const signerAddress = ethers.verifyMessage(message, payload.signature);

        if (
          signerAddress.toLowerCase() !== payload.walletAddress.toLowerCase()
        ) {
          throw new HttpException('Invalid signature', HttpStatus.BAD_REQUEST);
        }
      } catch (error) {
        throw new HttpException('Invalid signature', HttpStatus.BAD_REQUEST);
      }

      const registration = manager.create(Registration, {
        email: payload.email,
        walletAddress: payload.walletAddress,
        inviteCode: payload.code,
        signature: payload.signature,
      });
      await manager.save(registration);

      invite.currentUses += 1;
      await manager.save(invite);

      const updatedInviteCache = {
        ...invite,
        currentUses: invite.currentUses,
      };

      await Promise.all([
        this.redis.set(
          `${this.EMAIL_CACHE_PREFIX}${payload.email}`,
          'true',
          'EX',
          this.CACHE_TTL,
        ),
        this.redis.set(
          `${this.WALLET_CACHE_PREFIX}${payload.walletAddress}`,
          'true',
          'EX',
          this.CACHE_TTL,
        ),
        this.redis.set(
          `${this.INVITE_CACHE_PREFIX}${payload.code}`,
          JSON.stringify(updatedInviteCache),
          'EX',
          this.CACHE_TTL,
        ),
      ]);
    });
  }
}
