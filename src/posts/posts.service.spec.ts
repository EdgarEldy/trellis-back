import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { Like } from '../likes/entities/like.entity';

describe('PostsService', () => {
  let service: PostsService;
  let postsRepo: jest.Mocked<Repository<Post>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn((data) => Promise.resolve(data)),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Like),
          useValue: {
            find: jest.fn(),
            existsBy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PostsService);
    postsRepo = module.get(getRepositoryToken(Post));
  });

  describe('update', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      postsRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update('unknown-id', 'user-1', { title: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the caller is not the post author', async () => {
      postsRepo.findOneBy.mockResolvedValue({
        id: 'post-1',
        authorId: 'author-1',
        title: 'Old',
        content: 'Old content',
      } as Post);

      await expect(
        service.update('post-1', 'someone-else', { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
      expect(postsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the post does not exist', async () => {
      postsRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('unknown-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the post author', async () => {
      postsRepo.findOneBy.mockResolvedValue({
        id: 'post-1',
        authorId: 'author-1',
        imageUrl: null,
      } as Post);

      await expect(service.remove('post-1', 'someone-else')).rejects.toThrow(ForbiddenException);
      expect(postsRepo.delete).not.toHaveBeenCalled();
    });
  });
});
