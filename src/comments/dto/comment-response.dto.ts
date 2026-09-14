import { Comment } from '../entities/comment.entity';

export class CommentResponseDto {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  content: string;
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
