import { validationSchema } from './validation.schema';

describe('validationSchema', () => {
  it('passes when all required env vars are present', () => {
    const env = {
      NODE_ENV: 'test',
      PORT: 3000,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'my-super-secret',
      JWT_ACCESS_TTL: 900,
    };

    const { error } = validationSchema.validate(env, { abortEarly: false });
    expect(error).toBeUndefined();
  });

  it('fails validation when DATABASE_URL is missing', () => {
    const env = {
      NODE_ENV: 'test',
      JWT_SECRET: 'my-super-secret',
    };

    const { error } = validationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('fails validation when JWT_SECRET is missing', () => {
    const env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    };

    const { error } = validationSchema.validate(env, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_SECRET');
  });

  it('applies default value of 3000 for PORT when not set', () => {
    const env = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'my-super-secret',
    };

    const { value, error } = validationSchema.validate(env, {
      abortEarly: false,
    });
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
  });

  it('applies default value of 900 for JWT_ACCESS_TTL when not set', () => {
    const env = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'my-super-secret',
    };

    const { value, error } = validationSchema.validate(env, {
      abortEarly: false,
    });
    expect(error).toBeUndefined();
    expect(value.JWT_ACCESS_TTL).toBe(900);
  });
});
