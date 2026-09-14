import { registerAs } from '@nestjs/config';

export default registerAs('integrations', () => ({
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  firebaseServiceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
}));
