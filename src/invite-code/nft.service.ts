/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { NFT_GATING_ABI, NFT_GATING_ADDRESS } from 'src/constants/NFTGating';
import { Registration } from './entities/registration.entity';
import { RegisterNftDto } from './dto/register-nft.dto';

@Injectable()
export class NftService {
  private provider: ethers.Provider;
  private nftGatingContract: ethers.Contract;
  private rateLimiter: RateLimiterRedis;

  constructor(
    @InjectRepository(Registration)
    private dataSource: DataSource,
    private configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth');

    this.nftGatingContract = new ethers.Contract(
      NFT_GATING_ADDRESS,
      NFT_GATING_ABI,
      this.provider,
    );

    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: 'register_nft',
      points: 5, // Number of attempts
      duration: 60, // Per minute
    });
  }

  async registerWithNFT(dto: RegisterNftDto): Promise<Registration> {
    // Rate limiting check
    try {
      await this.rateLimiter.consume(dto.walletAddress);
    } catch (error) {
      throw new HttpException(
        'Too many attempts, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Verify signature
      try {
        const message = `Register with NFT token ID: ${dto.tokenId}`;
        const signerAddress = ethers.verifyMessage(message, dto.signature);

        if (signerAddress.toLowerCase() !== dto.walletAddress.toLowerCase()) {
          throw new HttpException('Invalid signature', HttpStatus.BAD_REQUEST);
        }
      } catch (error) {
        throw new HttpException('Invalid signature', HttpStatus.BAD_REQUEST);
      }

      // 2. Check if email is already used
      const emailExists = await manager.findOne(Registration, {
        where: { email: dto.email },
      });

      if (emailExists) {
        throw new HttpException(
          'Email already registered',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Check if wallet is already used
      const walletExists = await manager.findOne(Registration, {
        where: { walletAddress: dto.walletAddress },
      });

      if (walletExists) {
        throw new HttpException(
          'Wallet already registered',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. Check NFT staking status
      const isEligible = await this.nftGatingContract.meetsStakingRequirement(
        dto.tokenId,
      );

      if (!isEligible) {
        throw new HttpException(
          'NFT staking requirement not met',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 5. Create user
      const user = manager.create(Registration, {
        email: dto.email,
        walletAddress: dto.walletAddress,
        tokenId: dto.tokenId,
        registrationType: 'NFT',
        createdAt: new Date(),
      });

      // 6. Save user
      const savedUser = await manager.save(user);

      // 7. Cache user data
      await this.redis.setex(
        `user:${dto.email}`,
        3600, // 1 hour
        JSON.stringify({
          id: savedUser.id,
          email: savedUser.email,
          walletAddress: savedUser.walletAddress,
          tokenId: savedUser.tokenId,
        }),
      );

      return savedUser;
    });
  }

  async checkTokenEligibility(
    tokenId: number,
    walletAddress: string,
  ): Promise<{
    isEligible: boolean;
    remainingTime?: number;
  }> {
    try {
      // Check cache first
      const cacheKey = `token:${tokenId}:${walletAddress}`;
      const cachedResult = await this.redis.get(cacheKey);

      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // Get stake info from contract
      const stake = await this.nftGatingContract.stakes(tokenId);

      const currentTime = Math.floor(Date.now() / 1000);
      const weekInSeconds = 7 * 24 * 60 * 60;
      const elapsedTime = currentTime - Number(stake.timestamp);
      const remainingTime = Math.max(0, weekInSeconds - elapsedTime);

      const result = {
        isEligible: stake.isStaked && remainingTime === 0,
        remainingTime: stake.isStaked ? remainingTime : undefined,
      };

      // Cache result for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(result));

      return result;
    } catch (error: any) {
      throw new HttpException(
        'Error checking token eligibility',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
