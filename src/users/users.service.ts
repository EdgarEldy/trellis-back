import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return UserResponseDto.fromEntity(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.getUserOrThrow(userId);

    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName;
    }

    const saved = await this.usersRepo.save(user);
    return UserResponseDto.fromEntity(saved);
  }

  async updateAvatar(userId: string, filename: string): Promise<{ photoUrl: string }> {
    const user = await this.getUserOrThrow(userId);
    const previousPhotoUrl = user.photoUrl;

    user.photoUrl = `/uploads/avatars/${filename}`;
    await this.usersRepo.save(user);

    if (previousPhotoUrl) {
      await this.deleteAvatarFile(previousPhotoUrl);
    }

    return { photoUrl: user.photoUrl };
  }

  private async getUserOrThrow(id: string): Promise<User> {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async deleteAvatarFile(photoUrl: string): Promise<void> {
    const filename = photoUrl.split('/').pop();
    if (!filename) return;

    try {
      await unlink(join(AVATAR_UPLOAD_DIR, filename));
    } catch {
      // Previous file already missing on disk; nothing left to clean up.
    }
  }
}
