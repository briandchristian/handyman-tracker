/**
 * Keeps local development convenient while preventing test runs from overriding
 * explicitly set process env vars (such as temporary in-memory Mongo URIs).
 */
export function shouldOverrideDotenv(env = process.env) {
  const overrideFlag = String(env.DOTENV_OVERRIDE ?? '').trim().toLowerCase();
  if (overrideFlag === '1' || overrideFlag === 'true' || overrideFlag === 'yes') {
    return true;
  }
  if (overrideFlag === '0' || overrideFlag === 'false' || overrideFlag === 'no') {
    return false;
  }
  return String(env.NODE_ENV || '').trim().toLowerCase() !== 'test';
}
