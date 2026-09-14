import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepo: Repository<Device>,
  ) {}

  async register(userId: string, dto: RegisterDeviceDto): Promise<void> {
    const existing = await this.devicesRepo.findOneBy({ pushToken: dto.pushToken });

    if (existing) {
      await this.updateExisting(existing, userId, dto);
      return;
    }

    try {
      await this.devicesRepo.save(
        this.devicesRepo.create({
          userId,
          pushToken: dto.pushToken,
          platform: dto.platform,
        }),
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
      const raceWinner = await this.devicesRepo.findOneBy({ pushToken: dto.pushToken });
      if (raceWinner) {
        await this.updateExisting(raceWinner, userId, dto);
      }
    }
  }

  async remove(pushToken: string, userId: string): Promise<void> {
    await this.devicesRepo.delete({ pushToken, userId });
  }

  private async updateExisting(
    device: Device,
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<void> {
    device.userId = userId;
    device.platform = dto.platform;
    await this.devicesRepo.save(device);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
