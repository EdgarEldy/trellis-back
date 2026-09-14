import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn((data) => Promise.resolve(data)),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    usersRepo = module.get(getRepositoryToken(User));
  });

  describe('findById', () => {
    it('throws NotFoundException for an unknown id', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findById('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('returns the public user shape for a known id', async () => {
      usersRepo.findOneBy.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User One',
        photoUrl: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      } as User);

      const result = await service.findById('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'User One',
        photoUrl: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });
  });

  describe('updateProfile', () => {
    it('throws NotFoundException when the target user does not exist', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateProfile('unknown-id', { displayName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('leaves displayName untouched when the DTO does not send one', async () => {
      usersRepo.findOneBy.mockResolvedValue({
        id: 'user-1',
        displayName: 'Original Name',
        email: 'user@example.com',
        photoUrl: null,
        createdAt: new Date(),
      } as User);

      const result = await service.updateProfile('user-1', {});

      expect(result.displayName).toBe('Original Name');
    });
  });
});
