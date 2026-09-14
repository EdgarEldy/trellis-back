import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { applyCursorPagination, computeNextCursor } from '../common/pagination/cursor-pagination.util';

const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;

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
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findMany(
    postId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<PagedComments> {
    await this.assertPostExists(postId);
    const safeLimit = this.clampLimit(limit);

    const qb = this.commentsRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.postId = :postId', { postId });

    const cursorRef = cursor ? await this.findCursorRef(postId, cursor) : null;
    applyCursorPagination(qb, 'comment', cursorRef, safeLimit);

    const comments = await qb.getMany();

    return {
      items: comments.map((comment) => CommentResponseDto.fromEntity(comment)),
      nextCursor: computeNextCursor(comments, safeLimit),
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

    this.eventEmitter.emit('comment.created', { postId, authorId });

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

  private clampLimit(limit: number): number {
    return Math.min(Math.max(limit, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
  }

  private async findCursorRef(postId: string, cursor: string): Promise<Comment | null> {
    try {
      return await this.commentsRepo.findOneBy({ id: cursor, postId });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        return null;
      }
      throw error;
    }
  }
}
