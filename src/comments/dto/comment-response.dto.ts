import { ApiProperty } from '@nestjs/swagger';
import { Comment } from '../entities/comment.entity';

export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  postId: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  authorName: string;

  @ApiProperty({ nullable: true, type: String })
  authorPhotoUrl: string | null;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: string;

  static fromEntity(comment: Comment): CommentResponseDto {
    const dto = new CommentResponseDto();
    dto.id = comment.id;
    dto.postId = comment.postId;
    dto.authorId = comment.authorId;
    dto.authorName = comment.author.displayName;
    dto.authorPhotoUrl = comment.author.photoUrl;
    dto.content = comment.content;
    dto.createdAt = comment.createdAt.toISOString();
    return dto;
  }
}
