import { IsEmail, IsInt, Min, Max } from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  creatorEmail: string;

  @IsInt()
  @Min(1)
  @Max(100)
  maxUses: number;
}
