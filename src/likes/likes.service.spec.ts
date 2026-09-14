import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError, Repository } from 'typeorm';
import { LikesService } from './likes.service';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';

describe('LikesService', () => {
  let service: LikesService;
  let likesRepo: jest.Mocked<Repository<Like>>;
  let postsRepo: jest.Mocked<Repository<Post>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        {
          provide: getRepositoryToken(Like),
          useValue: {
            findOneBy: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            existsBy: jest.fn(),
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

    service = module.get(LikesService);
    likesRepo = module.get(getRepositoryToken(Like));
    postsRepo = module.get(getRepositoryToken(Post));
    eventEmitter = module.get(EventEmitter2);
  });

  describe('toggle', () => {
    it('flips liked true then false across two consecutive calls on a fresh post', async () => {
      postsRepo.existsBy.mockResolvedValue(true);

      likesRepo.findOneBy.mockResolvedValueOnce(null);
      likesRepo.count.mockResolvedValueOnce(1);
      const first = await service.toggle('post-1', 'user-1');
      expect(first).toEqual({ liked: true, likesCount: 1 });
      expect(likesRepo.insert).toHaveBeenCalledWith({ postId: 'post-1', userId: 'user-1' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('like.created', {
        postId: 'post-1',
        userId: 'user-1',
      });

      eventEmitter.emit.mockClear();
      likesRepo.findOneBy.mockResolvedValueOnce({ postId: 'post-1', userId: 'user-1' } as Like);
      likesRepo.count.mockResolvedValueOnce(0);
      const second = await service.toggle('post-1', 'user-1');
      expect(second).toEqual({ liked: false, likesCount: 0 });
      expect(likesRepo.delete).toHaveBeenCalledWith({ postId: 'post-1', userId: 'user-1' });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the post does not exist', async () => {
      postsRepo.existsBy.mockResolvedValue(false);

      await expect(service.toggle('unknown-post', 'user-1')).rejects.toThrow('Post not found');
      expect(likesRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('does not double-emit like.created when a concurrent insert wins the unique-constraint race', async () => {
      postsRepo.existsBy.mockResolvedValue(true);
      likesRepo.findOneBy.mockResolvedValue(null);
      likesRepo.insert.mockRejectedValue(
        new QueryFailedError('INSERT ...', undefined, { code: '23505' } as unknown as Error),
      );
      likesRepo.count.mockResolvedValue(1);

      const result = await service.toggle('post-1', 'user-1');

      expect(result).toEqual({ liked: true, likesCount: 1 });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
