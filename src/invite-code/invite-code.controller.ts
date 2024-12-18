import { Controller, Post, Body, Query, Get } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';
import { RegisterNftDto } from './dto/register-nft.dto';
import { NftService } from './nft.service';

@Controller()
export class InviteController {
  constructor(
    private readonly inviteService: InviteCodeService,
    private readonly nftService: NftService,
  ) {}

  @Get('verifyCode')
  async verifyCode(@Query('code') code: string) {
    const isValid = await this.inviteService.verifyInviteCode(code);
    if (!isValid) {
      return { success: false, message: 'Code is invalid or already used' };
    }
    return { success: true };
  }

  @Get('isEmailUsed')
  async checkEmail(@Query('email') email: string) {
    const isUsed = await this.inviteService.isEmailUsed(email);
    if (isUsed) {
      return { success: false, message: 'Email already used' };
    }
    return { success: true };
  }

  @Get('isWalletUsed')
  async checkWallet(@Query('wallet') wallet: string) {
    const isUsed = await this.inviteService.isWalletUsed(wallet);
    if (isUsed) {
      return { success: false, message: 'Wallet already used' };
    }
    return { success: true };
  }

  @Post('reserve')
  async reserve(
    @Body()
    payload: {
      code: string;
      email: string;
      walletAddress: string;
      signature: string;
    },
  ) {
    await this.inviteService.reserveInvite(payload);
    return { success: true };
  }

  @Post('register-nft')
  async registerNft(@Body() dto: RegisterNftDto) {
    const user = await this.nftService.registerWithNFT(dto);
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        tokenId: user.tokenId,
      },
    };
  }

  @Get('check-eligibility')
  async checkEligibility(
    @Query('tokenId') tokenId: number,
    @Query('walletAddress') walletAddress: string,
  ) {
    const result = await this.nftService.checkTokenEligibility(
      tokenId,
      walletAddress,
    );
    return {
      success: true,
      ...result,
    };
  }
}
