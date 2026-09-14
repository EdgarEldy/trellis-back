import { User } from '../entities/user.entity';

export class UserResponseDto {
  id: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
  createdAt: string;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.displayName = user.displayName;
    dto.email = user.email;
    dto.photoUrl = user.photoUrl;
    dto.createdAt = user.createdAt.toISOString();
    return dto;
  }
}
