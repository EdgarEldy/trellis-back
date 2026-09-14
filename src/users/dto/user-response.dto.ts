import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true, type: String })
  photoUrl: string | null;

  @ApiProperty()
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
