import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The opaque refresh token issued by register/login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
