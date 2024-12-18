import {
  IsEmail,
  IsEthereumAddress,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class RegisterNftDto {
  @IsEmail()
  email: string;

  @IsEthereumAddress()
  walletAddress: string;

  @IsNumber()
  @Min(0)
  tokenId: number;

  @IsString()
  signature: string;
}
