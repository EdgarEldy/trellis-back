import { Post } from '../entities/post.entity';

export class PostResponseDto {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  likesCount: number;
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
