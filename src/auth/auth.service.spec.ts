import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { GoogleAuthService } from '../integrations/google-auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: jest.Mocked<Repository<User>>;
  let refreshTokensRepo: jest.Mocked<Repository<RefreshToken>>;
  let googleAuthService: jest.Mocked<GoogleAuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn((data) => data),
            save: jest.fn((data) =>
              Promise.resolve({ id: 'user-1', createdAt: new Date(), ...data }),
            ),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn((data) => data),
            save: jest.fn((data) => Promise.resolve(data)),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-secret';
              if (key === 'jwt.accessTtl') return 900;
              return undefined;
            }),
          },
        },
        {
          provide: GoogleAuthService,
          useValue: {
            verifyIdToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersRepo = module.get(getRepositoryToken(User));
    refreshTokensRepo = module.get(getRepositoryToken(RefreshToken));
    googleAuthService = module.get(GoogleAuthService);
  });

  describe('register', () => {
    it('throws ConflictException when the email is already registered', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 'existing-user' } as User);

      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'password123',
          displayName: 'Taken',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password before persisting the new user', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);

      await service.register({
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
      });

      const savedUser = usersRepo.save.mock.calls[0][0] as Partial<User>;
      expect(savedUser.passwordHash).not.toBe('password123');
      await expect(
        bcrypt.compare('password123', savedUser.passwordHash as string),
      ).resolves.toBe(true);
    });
  });

  describe('login', () => {
    it('rejects an unknown email with the generic invalid credentials message', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects a wrong password with the same generic message as an unknown email', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      usersRepo.findOneBy.mockResolvedValue({
        id: 'user-1',
        email: 'known@example.com',
        passwordHash,
      } as User);

      await expect(
        service.login({ email: 'known@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('returns an access token, refresh token and user for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      usersRepo.findOneBy.mockResolvedValue({
        id: 'user-1',
        email: 'known@example.com',
        displayName: 'Known User',
        photoUrl: null,
        passwordHash,
        createdAt: new Date(),
      } as User);

      const result = await service.login({
        email: 'known@example.com',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('signed-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user.email).toBe('known@example.com');
    });
  });

  describe('loginWithGoogle', () => {
    it('rejects a tampered or expired Google ID token before any database lookup', async () => {
      googleAuthService.verifyIdToken.mockRejectedValue(
        new UnauthorizedException('Invalid Google ID token'),
      );

      await expect(service.loginWithGoogle('bad-token')).rejects.toThrow(UnauthorizedException);
      expect(usersRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('creates a new passwordless account when no user matches the verified email', async () => {
      googleAuthService.verifyIdToken.mockResolvedValue({
        email: 'new-google-user@example.com',
        displayName: 'New Google User',
        photoUrl: 'https://example.com/photo.jpg',
      });
      usersRepo.findOneBy.mockResolvedValue(null);

      const result = await service.loginWithGoogle('good-token');

      const savedUser = usersRepo.save.mock.calls[0][0] as Partial<User>;
      expect(savedUser.passwordHash).toBeNull();
      expect(savedUser.email).toBe('new-google-user@example.com');
      expect(result.user.email).toBe('new-google-user@example.com');
    });

    it('reuses the existing account when one already matches the verified email', async () => {
      googleAuthService.verifyIdToken.mockResolvedValue({
        email: 'known@example.com',
        displayName: 'Known User',
        photoUrl: null,
      });
      usersRepo.findOneBy.mockResolvedValue({
        id: 'user-1',
        email: 'known@example.com',
        displayName: 'Known User',
        photoUrl: null,
        createdAt: new Date(),
      } as User);

      await service.loginWithGoogle('good-token');

      expect(usersRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rejects a token whose hash matches no stored row', async () => {
      refreshTokensRepo.findOneBy.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token is invalid or expired'),
      );
    });

    it('rejects a token whose stored row is revoked', async () => {
      refreshTokensRepo.findOneBy.mockResolvedValue({
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      } as RefreshToken);

      await expect(service.refresh('revoked-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token is invalid or expired'),
      );
    });

    it('rejects a token whose stored row is past its expiresAt', async () => {
      refreshTokensRepo.findOneBy.mockResolvedValue({
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      } as RefreshToken);

      await expect(service.refresh('expired-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token is invalid or expired'),
      );
    });

    it('returns a new access token for a valid, unrevoked, unexpired refresh token', async () => {
      refreshTokensRepo.findOneBy.mockResolvedValue({
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      } as RefreshToken);

      const result = await service.refresh('valid-token');

      expect(result).toEqual({ accessToken: 'signed-access-token' });
    });
  });

  describe('logout', () => {
    it('resolves without throwing when the token matches no stored row', async () => {
      refreshTokensRepo.findOneBy.mockResolvedValue(null);

      await expect(service.logout('unknown-token')).resolves.toBeUndefined();
      expect(refreshTokensRepo.save).not.toHaveBeenCalled();
    });

    it('sets revokedAt on the matching row when the token is found', async () => {
      const storedToken = {
        userId: 'user-1',
        revokedAt: null,
      } as RefreshToken;
      refreshTokensRepo.findOneBy.mockResolvedValue(storedToken);

      await service.logout('valid-token');

      expect(refreshTokensRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });
});
