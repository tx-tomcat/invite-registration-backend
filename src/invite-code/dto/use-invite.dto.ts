import { IsString, IsEmail, Length } from 'class-validator';

export class UseInviteDto {
  @IsString()
  @Length(8, 8)
  code: string;

  @IsEmail()
  userEmail: string;
}
