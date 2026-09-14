import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepo: Repository<Device>,
  ) {}

  async register(userId: string, dto: RegisterDeviceDto): Promise<void> {
    const existing = await this.devicesRepo.findOneBy({ pushToken: dto.pushToken });

    if (existing) {
      existing.userId = userId;
      existing.platform = dto.platform;
      await this.devicesRepo.save(existing);
      return;
    }

    await this.devicesRepo.save(
      this.devicesRepo.create({
        userId,
        pushToken: dto.pushToken,
        platform: dto.platform,
      }),
    );
  }

  async remove(pushToken: string): Promise<void> {
    await this.devicesRepo.delete({ pushToken });
  }
}
