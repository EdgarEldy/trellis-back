import { ApiProperty } from '@nestjs/swagger';
import { Post } from '../entities/post.entity';

export class PostResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  authorName: string;

  @ApiProperty({ nullable: true, type: String })
  authorPhotoUrl: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ nullable: true, type: String })
  imageUrl: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  commentsCount: number;

  @ApiProperty()
  likesCount: number;

  @ApiProperty()
  isLikedByMe: boolean;

  static fromEntity(post: Post, isLikedByMe: boolean): PostResponseDto {
    const dto = new PostResponseDto();
    dto.id = post.id;
    dto.authorId = post.authorId;
    dto.authorName = post.author.displayName;
    dto.authorPhotoUrl = post.author.photoUrl;
    dto.title = post.title;
    dto.content = post.content;
    dto.imageUrl = post.imageUrl;
    dto.createdAt = post.createdAt.toISOString();
    dto.updatedAt = post.updatedAt.toISOString();
    dto.commentsCount = post.commentsCount ?? 0;
    dto.likesCount = post.likesCount ?? 0;
    dto.isLikedByMe = isLikedByMe;
    return dto;
  }
}
