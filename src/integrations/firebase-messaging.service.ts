import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

const UNREGISTERED_TOKEN_ERROR_CODE = 'messaging/registration-token-not-registered';

@Injectable()
export class FirebaseMessagingService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseMessagingService.name);
  private messaging: Messaging | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const serviceAccountKey = this.configService.get<string>(
      'integrations.firebaseServiceAccountKey',
    );
    if (!serviceAccountKey) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_KEY is not configured; push notifications are disabled.',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      const app = initializeApp({ credential: cert(serviceAccount) });
      this.messaging = getMessaging(app);
    } catch (error) {
      this.logger.error(
        'Failed to initialize the Firebase Admin SDK; push notifications are disabled.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async send(pushToken: string, notification: { title: string; body: string }): Promise<void> {
    if (!this.messaging) return;
    await this.messaging.send({ token: pushToken, notification });
  }

  isUnregisteredTokenError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === UNREGISTERED_TOKEN_ERROR_CODE
    );
  }
}
