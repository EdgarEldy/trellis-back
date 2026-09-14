import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;

  const createContext = (headers: Record<string, string> = {}): { context: ExecutionContext; request: { headers: Record<string, string>; user?: { userId: string } } } => {
    const request: { headers: Record<string, string>; user?: { userId: string } } = { headers };
    const context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
      getHandler: () => (() => undefined),
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    jwtService = { verifyAsync: jest.fn() } as unknown as jest.Mocked<JwtService>;
    const configService = {
      get: jest.fn((key: string) => (key === 'jwt.secret' ? 'test-secret' : undefined)),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new AuthGuard(reflector, jwtService, configService);
  });

  it('allows a request through without checking the token when the route is @Public()', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the Authorization header is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the Authorization header is not a Bearer token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = createContext({ authorization: 'Basic abc123' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when verifyAsync rejects an invalid or expired token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const { context } = createContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches userId to request.user and returns true for a valid token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
    const { context, request } = createContext({ authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1' });
  });
});
