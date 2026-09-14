import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
}));
