import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Post } from './entities/post.entity';
import { Like } from '../likes/entities/like.entity';
import { PostResponseDto } from './dto/post-response.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { applyCursorPagination, computeNextCursor } from '../common/pagination/cursor-pagination.util';

const POST_IMAGE_UPLOAD_DIR = join(process.cwd(), 'uploads', 'posts');
const DEFAULT_PAGE_SIZE = 20;

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
    const qb = this.postsRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .loadRelationCountAndMap('post.commentsCount', 'post.comments')
      .loadRelationCountAndMap('post.likesCount', 'post.likes');

    const cursorRef = cursor ? await this.postsRepo.findOneBy({ id: cursor }) : null;
    applyCursorPagination(qb, 'post', cursorRef, limit);

    const posts = await qb.getMany();
    const likedPostIds = await this.findLikedPostIds(currentUserId, posts);

    return {
      items: posts.map((post) => PostResponseDto.fromEntity(post, likedPostIds.has(post.id))),
      nextCursor: computeNextCursor(posts, limit),
    };
  }

  async findOneById(id: string, currentUserId: string): Promise<PostResponseDto> {
    const post = await this.getPostWithCounts(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isLikedByMe = await this.likesRepo.existsBy({ postId: id, userId: currentUserId });
    return PostResponseDto.fromEntity(post, isLikedByMe);
  }

  async create(authorId: string, dto: CreatePostDto, imageUrl: string | null): Promise<PostResponseDto> {
    const post = await this.postsRepo.save(
      this.postsRepo.create({
        authorId,
        title: dto.title,
        content: dto.content,
        imageUrl,
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
      select: ['postId'],
    });

    return new Set(myLikes.map((like) => like.postId));
  }

  private async getPostWithCounts(id: string): Promise<Post | null> {
    return this.postsRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .loadRelationCountAndMap('post.commentsCount', 'post.comments')
      .loadRelationCountAndMap('post.likesCount', 'post.likes')
      .where('post.id = :id', { id })
      .getOne();
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
