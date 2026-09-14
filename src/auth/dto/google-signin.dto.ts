import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleSigninDto {
  @ApiProperty({ description: "The Google ID token from the client's own Google Sign-In flow" })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
