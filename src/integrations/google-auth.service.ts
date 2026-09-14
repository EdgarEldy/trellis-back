import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleUser {
  email: string;
  displayName: string;
  photoUrl: string | null;
}

@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.client = new OAuth2Client(this.configService.get<string>('integrations.googleClientId'));
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    const clientId = this.configService.get<string>('integrations.googleClientId');
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let payload: { email?: string; name?: string; picture?: string } | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    return {
      email: payload.email,
      displayName: payload.name ?? payload.email,
      photoUrl: payload.picture ?? null,
    };
  }
}
