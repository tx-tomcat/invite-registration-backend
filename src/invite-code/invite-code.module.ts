import { Module } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteCode } from './entities/invite-code.entity';
import { CodeUsage } from './entities/code-usage.entity';
import { InviteController } from './invite-code.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@nestjs-modules/ioredis';
import { Registration } from './entities/registration.entity';
import { NftService } from './nft.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InviteCode, CodeUsage, Registration]), // Register both entities

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    RedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379',
    }),
  ],
  controllers: [InviteController],
  providers: [InviteCodeService, NftService],
})
export class InviteCodeModule {}
