/**
 * Integration-level bootstrap test.
 * The full AppModule cannot be compiled in unit tests because DatabaseModule
 * requires a live PostgreSQL connection. This test validates the configuration
 * layer in isolation; the E2E suite (test/app.e2e-spec.ts) covers full bootstrap.
 */
describe('AppModule (bootstrap validation)', () => {
  it('the configuration layer is importable', () => {
    // If the config files contain syntax errors or invalid imports, this require
    // call will throw and fail the test before any expect runs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validationSchema } = require('./config/validation.schema');
    expect(validationSchema).toBeDefined();
  });
});
