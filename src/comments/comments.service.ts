import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { applyCursorPagination, computeNextCursor } from '../common/pagination/cursor-pagination.util';

const DEFAULT_PAGE_SIZE = 20;

export interface PagedComments {
  items: CommentResponseDto[];
  nextCursor: string | null;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepo: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postsRepo: Repository<Post>,
  ) {}

  async findMany(
    postId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<PagedComments> {
    await this.assertPostExists(postId);

    const qb = this.commentsRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.postId = :postId', { postId });

    const cursorRef = cursor ? await this.commentsRepo.findOneBy({ id: cursor }) : null;
    applyCursorPagination(qb, 'comment', cursorRef, limit);

    const comments = await qb.getMany();

    return {
      items: comments.map((comment) => CommentResponseDto.fromEntity(comment)),
      nextCursor: computeNextCursor(comments, limit),
    };
  }

  async create(postId: string, authorId: string, dto: CreateCommentDto): Promise<CommentResponseDto> {
    await this.assertPostExists(postId);

    const comment = await this.commentsRepo.save(
      this.commentsRepo.create({ postId, authorId, content: dto.content }),
    );

    const withAuthor = await this.commentsRepo.findOneOrFail({
      where: { id: comment.id },
      relations: { author: true },
    });

    return CommentResponseDto.fromEntity(withAuthor);
  }

  async remove(id: string, currentUserId: string): Promise<void> {
    const comment = await this.commentsRepo.findOneBy({ id });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to modify this comment');
    }

    await this.commentsRepo.delete({ id });
  }

  private async assertPostExists(postId: string): Promise<void> {
    const exists = await this.postsRepo.existsBy({ id: postId });
    if (!exists) {
      throw new NotFoundException('Post not found');
    }
  }
}
