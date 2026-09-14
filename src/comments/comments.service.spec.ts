import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentsRepo: jest.Mocked<Repository<Comment>>;
  let postsRepo: jest.Mocked<Repository<Post>>;

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
      ],
    }).compile();

    service = module.get(CommentsService);
    commentsRepo = module.get(getRepositoryToken(Comment));
    postsRepo = module.get(getRepositoryToken(Post));
  });

  describe('create', () => {
    it('throws NotFoundException when the post does not exist, before any insert', async () => {
      postsRepo.existsBy.mockResolvedValue(false);

      await expect(
        service.create('unknown-post', 'author-1', { content: 'Hello' }),
      ).rejects.toThrow(NotFoundException);
      expect(commentsRepo.save).not.toHaveBeenCalled();
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
