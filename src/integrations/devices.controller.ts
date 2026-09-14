import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@CurrentUser() userId: string, @Body() dto: RegisterDeviceDto): Promise<void> {
    await this.devicesService.register(userId, dto);
  }

  @Delete(':pushToken')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('pushToken') pushToken: string,
    @CurrentUser() userId: string,
  ): Promise<void> {
    await this.devicesService.remove(pushToken, userId);
  }
}
