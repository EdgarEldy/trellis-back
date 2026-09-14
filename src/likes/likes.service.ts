import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError, Repository } from 'typeorm';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export interface ToggleLikeResult {
  liked: boolean;
  likesCount: number;
}

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepo: Repository<Like>,
    @InjectRepository(Post)
    private readonly postsRepo: Repository<Post>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async toggle(postId: string, userId: string): Promise<ToggleLikeResult> {
    await this.assertPostExists(postId);

    const existing = await this.likesRepo.findOneBy({ postId, userId });
    let liked: boolean;
    if (existing) {
      await this.likesRepo.delete({ postId, userId });
      liked = false;
    } else {
      liked = await this.createLike(postId, userId);
      if (liked) {
        this.eventEmitter.emit('like.created', { postId, userId });
      }
    }

    const likesCount = await this.likesRepo.count({ where: { postId } });
    return { liked, likesCount };
  }

  async isLikedByMe(postId: string, userId: string): Promise<{ liked: boolean }> {
    await this.assertPostExists(postId);
    const liked = await this.likesRepo.existsBy({ postId, userId });
    return { liked };
  }

  private async createLike(postId: string, userId: string): Promise<boolean> {
    try {
      await this.likesRepo.insert({ postId, userId });
      return true;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return true;
      }
      throw error;
    }
  }

  private async assertPostExists(postId: string): Promise<void> {
    const exists = await this.postsRepo.existsBy({ id: postId });
    if (!exists) {
      throw new NotFoundException('Post not found');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
