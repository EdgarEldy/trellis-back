import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAuthService } from './google-auth.service';

jest.mock('google-auth-library');

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockVerifyIdToken: jest.Mock;

  beforeEach(async () => {
    mockVerifyIdToken = jest.fn();
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-google-client-id'),
          },
        },
      ],
    }).compile();

    service = module.get(GoogleAuthService);
  });

  it('rejects a tampered or expired Google ID token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token used too late, at: 123 < now: 456'));

    await expect(service.verifyIdToken('tampered-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a verified token whose payload carries no email claim', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ name: 'No Email' }) });

    await expect(service.verifyIdToken('token-without-email')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose email claim is not verified', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'unverified@example.com', email_verified: false }),
    });

    await expect(service.verifyIdToken('unverified-email-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns the verified email, name and picture for a valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'user@example.com',
        email_verified: true,
        name: 'A User',
        picture: 'https://example.com/photo.jpg',
      }),
    });

    const result = await service.verifyIdToken('good-token');

    expect(result).toEqual({
      email: 'user@example.com',
      displayName: 'A User',
      photoUrl: 'https://example.com/photo.jpg',
    });
  });

  it('rejects immediately when no Google client id is configured, without calling Google', async () => {
    const unconfiguredModule: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    const unconfiguredService = unconfiguredModule.get(GoogleAuthService);

    await expect(unconfiguredService.verifyIdToken('any-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});
