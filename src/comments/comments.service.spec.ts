import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentsRepo: jest.Mocked<Repository<Comment>>;
  let postsRepo: jest.Mocked<Repository<Post>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn((data) => Promise.resolve({ id: 'comment-1', ...data })),
            create: jest.fn((data) => data),
            delete: jest.fn(),
            findOneOrFail: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Post),
          useValue: {
            existsBy: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CommentsService);
    commentsRepo = module.get(getRepositoryToken(Comment));
    postsRepo = module.get(getRepositoryToken(Post));
    eventEmitter = module.get(EventEmitter2);
  });

  describe('create', () => {
    it('throws NotFoundException when the post does not exist, before any insert', async () => {
      postsRepo.existsBy.mockResolvedValue(false);

      await expect(
        service.create('unknown-post', 'author-1', { content: 'Hello' }),
      ).rejects.toThrow(NotFoundException);
      expect(commentsRepo.save).not.toHaveBeenCalled();
    });

    it('emits comment.created with the postId and authorId after a successful create', async () => {
      postsRepo.existsBy.mockResolvedValue(true);
      commentsRepo.findOneOrFail.mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        authorId: 'author-1',
        content: 'Hello',
        author: { displayName: 'Author', photoUrl: null },
        createdAt: new Date(),
      } as Comment);

      await service.create('post-1', 'author-1', { content: 'Hello' });

      expect(eventEmitter.emit).toHaveBeenCalledWith('comment.created', {
        postId: 'post-1',
        authorId: 'author-1',
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the comment does not exist', async () => {
      commentsRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('unknown-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the comment author', async () => {
      commentsRepo.findOneBy.mockResolvedValue({
        id: 'comment-1',
        authorId: 'author-1',
      } as Comment);

      await expect(service.remove('comment-1', 'someone-else')).rejects.toThrow(ForbiddenException);
      expect(commentsRepo.delete).not.toHaveBeenCalled();
    });
  });
});
