import { shouldOverrideDotenv } from '../envConfig.js';

describe('shouldOverrideDotenv', () => {
  test('returns false in test environment', () => {
    expect(shouldOverrideDotenv({ NODE_ENV: 'test' })).toBe(false);
  });

  test('returns true outside test by default', () => {
    expect(shouldOverrideDotenv({ NODE_ENV: 'development' })).toBe(true);
  });

  test('allows explicit opt-in via DOTENV_OVERRIDE in test', () => {
    expect(shouldOverrideDotenv({ NODE_ENV: 'test', DOTENV_OVERRIDE: '1' })).toBe(true);
  });

  test('allows explicit opt-out outside test', () => {
    expect(shouldOverrideDotenv({ NODE_ENV: 'development', DOTENV_OVERRIDE: '0' })).toBe(false);
  });
});
