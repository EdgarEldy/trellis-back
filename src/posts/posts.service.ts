import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Post } from './entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Like } from '../likes/entities/like.entity';
import { PostResponseDto } from './dto/post-response.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { applyCursorPagination, computeNextCursor } from '../common/pagination/cursor-pagination.util';

const POST_IMAGE_UPLOAD_DIR = join(process.cwd(), 'uploads', 'posts');
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;

export interface PagedPosts {
  items: PostResponseDto[];
  nextCursor: string | null;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepo: Repository<Post>,
    @InjectRepository(Like)
    private readonly likesRepo: Repository<Like>,
  ) {}

  async findMany(
    currentUserId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<PagedPosts> {
    const safeLimit = this.clampLimit(limit);
    const qb = this.withCounts(
      this.postsRepo.createQueryBuilder('post').leftJoinAndSelect('post.author', 'author'),
    );

    const cursorRef = cursor ? await this.findCursorRef(cursor) : null;
    applyCursorPagination(qb, 'post', cursorRef, safeLimit);

    const posts = await this.getManyWithCounts(qb);
    const likedPostIds = await this.findLikedPostIds(currentUserId, posts);

    return {
      items: posts.map((post) => PostResponseDto.fromEntity(post, likedPostIds.has(post.id))),
      nextCursor: computeNextCursor(posts, safeLimit),
    };
  }

  async findOneById(id: string, currentUserId: string): Promise<PostResponseDto> {
    const qb = this.withCounts(
      this.postsRepo
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author')
        .where('post.id = :id', { id }),
    );

    const [post] = await this.getManyWithCounts(qb);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isLikedByMe = await this.likesRepo.existsBy({ postId: id, userId: currentUserId });
    return PostResponseDto.fromEntity(post, isLikedByMe);
  }

  async create(
    authorId: string,
    dto: CreatePostDto,
    imageFilename: string | undefined,
  ): Promise<PostResponseDto> {
    const post = await this.postsRepo.save(
      this.postsRepo.create({
        authorId,
        title: dto.title,
        content: dto.content,
        imageUrl: imageFilename ? `/uploads/posts/${imageFilename}` : null,
      }),
    );

    return this.findOneById(post.id, authorId);
  }

  async update(id: string, authorId: string, dto: UpdatePostDto): Promise<PostResponseDto> {
    const post = await this.getPostOrThrow(id);
    this.assertIsAuthor(post, authorId);

    if (dto.title !== undefined) {
      post.title = dto.title;
    }
    if (dto.content !== undefined) {
      post.content = dto.content;
    }

    await this.postsRepo.save(post);
    return this.findOneById(id, authorId);
  }

  async remove(id: string, authorId: string): Promise<void> {
    const post = await this.getPostOrThrow(id);
    this.assertIsAuthor(post, authorId);

    await this.postsRepo.delete({ id });

    if (post.imageUrl) {
      await this.deleteImageFile(post.imageUrl);
    }
  }

  private async findLikedPostIds(currentUserId: string, posts: Post[]): Promise<Set<string>> {
    if (posts.length === 0) {
      return new Set();
    }

    const postIds = posts.map((post) => post.id);
    const myLikes = await this.likesRepo.find({
      where: { postId: In(postIds), userId: currentUserId },
      select: { postId: true },
    });

    return new Set(myLikes.map((like) => like.postId));
  }

  // loadRelationCountAndMap does not exist on this installed TypeORM version; these correlated
  // subqueries via addSelect are the replacement, still one round trip for the whole page.
  private withCounts(qb: SelectQueryBuilder<Post>): SelectQueryBuilder<Post> {
    return qb
      .addSelect(
        (subQb) =>
          subQb
            .select('COUNT(*)', 'count')
            .from(Comment, 'comment')
            .where('comment.postId = post.id'),
        'post_commentsCount',
      )
      .addSelect(
        (subQb) =>
          subQb.select('COUNT(*)', 'count').from(Like, 'like').where('like.postId = post.id'),
        'post_likesCount',
      );
  }

  private async getManyWithCounts(qb: SelectQueryBuilder<Post>): Promise<Post[]> {
    const { entities, raw } = await qb.getRawAndEntities();
    entities.forEach((post, index) => {
      post.commentsCount = parseInt(raw[index].post_commentsCount as string, 10);
      post.likesCount = parseInt(raw[index].post_likesCount as string, 10);
    });
    return entities;
  }

  private clampLimit(limit: number): number {
    return Math.min(Math.max(limit, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
  }

  private async findCursorRef(cursor: string): Promise<Post | null> {
    try {
      return await this.postsRepo.findOneBy({ id: cursor });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        return null;
      }
      throw error;
    }
  }

  private async getPostOrThrow(id: string): Promise<Post> {
    const post = await this.postsRepo.findOneBy({ id });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  private assertIsAuthor(post: Post, currentUserId: string): void {
    if (post.authorId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to modify this post');
    }
  }

  private async deleteImageFile(imageUrl: string): Promise<void> {
    const filename = imageUrl.split('/').pop();
    if (!filename) return;

    try {
      await unlink(join(POST_IMAGE_UPLOAD_DIR, filename));
    } catch {
      // Image already missing on disk; nothing left to clean up.
    }
  }
}
