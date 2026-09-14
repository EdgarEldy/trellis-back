import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Platform } from '../entities/device.entity';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'The FCM registration token for this device' })
  @IsString()
  @IsNotEmpty()
  pushToken: string;

  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform: Platform;
}
