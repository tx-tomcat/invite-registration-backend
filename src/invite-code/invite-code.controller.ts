import { Controller, Post, Body, Query, Get } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';

@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteCodeService) {}

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
}
