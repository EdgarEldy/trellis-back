import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsListener } from './notifications.listener';
import { Post } from '../posts/entities/post.entity';
import { Device, Platform } from './entities/device.entity';
import { FirebaseMessagingService } from './firebase-messaging.service';

describe('NotificationsListener', () => {
  let listener: NotificationsListener;
  let postsRepo: jest.Mocked<Repository<Post>>;
  let devicesRepo: jest.Mocked<Repository<Device>>;
  let firebaseMessagingService: jest.Mocked<FirebaseMessagingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsListener,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Device),
          useValue: {
            findBy: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: FirebaseMessagingService,
          useValue: {
            send: jest.fn(),
            isUnregisteredTokenError: jest.fn(),
          },
        },
      ],
    }).compile();

    listener = module.get(NotificationsListener);
    postsRepo = module.get(getRepositoryToken(Post));
    devicesRepo = module.get(getRepositoryToken(Device));
    firebaseMessagingService = module.get(FirebaseMessagingService);
  });

  describe('handleCommentCreated', () => {
    it('does not send a push when the actor is the post\'s own author', async () => {
      postsRepo.findOneBy.mockResolvedValue({ id: 'post-1', authorId: 'author-1' } as Post);

      await listener.handleCommentCreated({ postId: 'post-1', authorId: 'author-1' });

      expect(devicesRepo.findBy).not.toHaveBeenCalled();
      expect(firebaseMessagingService.send).not.toHaveBeenCalled();
    });

    it('sends a push to the post author\'s devices when someone else comments', async () => {
      postsRepo.findOneBy.mockResolvedValue({ id: 'post-1', authorId: 'author-1' } as Post);
      devicesRepo.findBy.mockResolvedValue([
        { id: 'device-1', userId: 'author-1', pushToken: 'token-1', platform: Platform.IOS } as Device,
      ]);

      await listener.handleCommentCreated({ postId: 'post-1', authorId: 'commenter-1' });

      expect(devicesRepo.findBy).toHaveBeenCalledWith({ userId: 'author-1' });
      expect(firebaseMessagingService.send).toHaveBeenCalledWith(
        'token-1',
        expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
      );
    });

    it('does nothing when the post no longer exists', async () => {
      postsRepo.findOneBy.mockResolvedValue(null);

      await listener.handleCommentCreated({ postId: 'missing-post', authorId: 'commenter-1' });

      expect(devicesRepo.findBy).not.toHaveBeenCalled();
    });
  });

  describe('handleLikeCreated', () => {
    it('does not send a push when the actor liked their own post', async () => {
      postsRepo.findOneBy.mockResolvedValue({ id: 'post-1', authorId: 'author-1' } as Post);

      await listener.handleLikeCreated({ postId: 'post-1', userId: 'author-1' });

      expect(devicesRepo.findBy).not.toHaveBeenCalled();
    });
  });

  describe('a device with an unregistered token', () => {
    it('deletes the Device row when send fails with messaging/registration-token-not-registered', async () => {
      postsRepo.findOneBy.mockResolvedValue({ id: 'post-1', authorId: 'author-1' } as Post);
      devicesRepo.findBy.mockResolvedValue([
        {
          id: 'device-1',
          userId: 'author-1',
          pushToken: 'stale-token',
          platform: Platform.ANDROID,
        } as Device,
      ]);
      const unregisteredError = Object.assign(new Error('not registered'), {
        code: 'messaging/registration-token-not-registered',
      });
      firebaseMessagingService.send.mockRejectedValue(unregisteredError);
      firebaseMessagingService.isUnregisteredTokenError.mockReturnValue(true);

      await listener.handleCommentCreated({ postId: 'post-1', authorId: 'commenter-1' });

      expect(devicesRepo.delete).toHaveBeenCalledWith({ pushToken: 'stale-token' });
    });

    it('does not delete the Device row for any other send failure', async () => {
      postsRepo.findOneBy.mockResolvedValue({ id: 'post-1', authorId: 'author-1' } as Post);
      devicesRepo.findBy.mockResolvedValue([
        {
          id: 'device-1',
          userId: 'author-1',
          pushToken: 'temporarily-unreachable',
          platform: Platform.WEB,
        } as Device,
      ]);
      firebaseMessagingService.send.mockRejectedValue(new Error('server unavailable'));
      firebaseMessagingService.isUnregisteredTokenError.mockReturnValue(false);

      await listener.handleCommentCreated({ postId: 'post-1', authorId: 'commenter-1' });

      expect(devicesRepo.delete).not.toHaveBeenCalled();
    });
  });
});
